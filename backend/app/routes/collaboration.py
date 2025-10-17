from flask import Blueprint, request, jsonify
from flasgger import swag_from
from app.services.collaboration_service import CollaborationService
from app.services.canvas_service import CanvasService
from app.services.auth_service import require_auth
from app.schemas.validation_schemas import CollaborationInviteSchema, PresenceUpdateSchema
from app.middleware.rate_limiting import collaboration_rate_limit
from app.utils.validators import ValidationError
from app.services.sanitization_service import SanitizationService

collaboration_bp = Blueprint('collaboration', __name__)
collaboration_service = CollaborationService()
canvas_service = CanvasService()

@collaboration_bp.route('/invite', methods=['POST'])
@require_auth
@collaboration_rate_limit('invite')
@swag_from({
    'tags': ['Collaboration'],
    'summary': 'Invite a user to collaborate on a canvas',
    'description': 'Send an invitation to a user to collaborate on a canvas with specified permissions',
    'security': [{'Bearer': []}],
    'parameters': [
        {
            'name': 'body',
            'in': 'body',
            'required': True,
            'schema': {
                'type': 'object',
                'properties': {
                    'canvas_id': {
                        'type': 'string',
                        'description': 'ID of the canvas to invite user to'
                    },
                    'invitee_email': {
                        'type': 'string',
                        'format': 'email',
                        'description': 'Email address of the user to invite'
                    },
                    'permission_type': {
                        'type': 'string',
                        'enum': ['view', 'edit'],
                        'description': 'Permission level to grant (view or edit)'
                    },
                    'invitation_message': {
                        'type': 'string',
                        'description': 'Optional invitation message (max 1000 characters)'
                    }
                },
                'required': ['canvas_id', 'invitee_email', 'permission_type']
            }
        }
    ],
    'responses': {
        201: {
            'description': 'Invitation sent successfully',
            'schema': {
                'type': 'object',
                'properties': {
                    'message': {'type': 'string'},
                    'invitation': {
                        'type': 'object',
                        'properties': {
                            'id': {'type': 'string'},
                            'canvas_id': {'type': 'string'},
                            'inviter_id': {'type': 'string'},
                            'invitee_email': {'type': 'string'},
                            'permission_type': {'type': 'string'},
                            'status': {'type': 'string'},
                            'expires_at': {'type': 'string'},
                            'created_at': {'type': 'string'}
                        }
                    }
                }
            }
        },
        400: {
            'description': 'Bad request - missing required fields or invalid data',
            'schema': {
                'type': 'object',
                'properties': {
                    'error': {'type': 'string'},
                    'details': {'type': 'object'}
                }
            }
        },
        403: {
            'description': 'Access denied - only canvas owner can invite users',
            'schema': {
                'type': 'object',
                'properties': {
                    'error': {'type': 'string'}
                }
            }
        },
        429: {
            'description': 'Rate limit exceeded',
            'schema': {
                'type': 'object',
                'properties': {
                    'error': {'type': 'string'},
                    'retry_after': {'type': 'number'}
                }
            }
        }
    }
})
def invite_user(current_user):
    """Invite a user to collaborate on a canvas with comprehensive security validation."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400
        
        # Validate input using comprehensive schema
        schema = CollaborationInviteSchema()
        try:
            validated_data = schema.load(data)
        except ValidationError as e:
            return jsonify({'error': 'Validation failed', 'details': e.messages}), 400
        
        canvas_id = validated_data['canvas_id']
        invitee_email = validated_data['invitee_email']
        permission_type = validated_data['permission_type']
        invitation_message = validated_data.get('invitation_message')
        
        # Additional security validations
        from app.utils.validators import InputValidator
        
        # Validate canvas ID format and length
        try:
            canvas_id = InputValidator.validate_canvas_id(canvas_id)
        except ValidationError as e:
            return jsonify({'error': f'Invalid canvas ID: {str(e)}'}), 400
        
        # Validate email format and length (already done by schema, but double-check)
        try:
            invitee_email = InputValidator.validate_email_address(invitee_email)
        except ValidationError as e:
            return jsonify({'error': f'Invalid email address: {str(e)}'}), 400
        
        # Validate permission type enum
        try:
            permission_type = InputValidator.validate_enum_value(
                permission_type, 'permission_type', ['view', 'edit']
            )
        except ValidationError as e:
            return jsonify({'error': str(e)}), 400
        
        # Check if user is owner with additional security
        canvas = canvas_service.get_canvas_by_id(canvas_id)
        if not canvas:
            return jsonify({'error': 'Canvas not found'}), 404
        
        if canvas.owner_id != current_user.id:
            return jsonify({'error': 'Only the canvas owner can invite users'}), 403
        
        # Prevent self-invitation
        if invitee_email.lower() == current_user.email.lower():
            return jsonify({'error': 'Cannot invite yourself'}), 400
        
        # Sanitize invitation message if provided
        if invitation_message:
            invitation_message = SanitizationService.sanitize_invitation_message(invitation_message)
        
        # Check for existing invitation to prevent spam
        existing_invitation = collaboration_service.get_pending_invitation(canvas_id, invitee_email)
        if existing_invitation:
            return jsonify({'error': 'Invitation already sent to this user'}), 409
        
        invitation = collaboration_service.invite_user_to_canvas(
            canvas_id=canvas_id,
            inviter_id=current_user.id,
            invitee_email=invitee_email,
            permission_type=permission_type,
            invitation_message=invitation_message
        )
        
        return jsonify({
            'message': 'Invitation sent successfully',
            'invitation': invitation.to_dict()
        }), 201
        
    except ValidationError as e:
        return jsonify({'error': 'Validation failed', 'details': str(e)}), 400
    except Exception as e:
        # Secure error handling - don't expose internal details
        return jsonify({'error': 'Internal server error'}), 500

@collaboration_bp.route('/invitations', methods=['GET'])
@require_auth
def get_invitations(current_user):
    """Get all pending invitations for the current user."""
    try:
        invitations = collaboration_service.get_user_invitations(current_user.id)
        return jsonify({
            'invitations': [invitation.to_dict() for invitation in invitations]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@collaboration_bp.route('/canvas/<canvas_id>/invitations', methods=['GET'])
@require_auth
def get_canvas_invitations(current_user, canvas_id):
    """Get all invitations for a specific canvas."""
    try:
        # Check if user is canvas owner
        canvas = canvas_service.get_canvas_by_id(canvas_id)
        if not canvas or canvas.owner_id != current_user.id:
            return jsonify({'error': 'Only the canvas owner can view invitations'}), 403
        
        invitations = collaboration_service.get_canvas_invitations(canvas_id)
        return jsonify({
            'invitations': [invitation.to_dict() for invitation in invitations]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@collaboration_bp.route('/invitations/<invitation_id>/resend', methods=['POST'])
@require_auth
def resend_invitation(current_user, invitation_id):
    """Resend an invitation email."""
    try:
        invitation = collaboration_service.resend_invitation(invitation_id, current_user.id)
        return jsonify({
            'message': 'Invitation resent successfully',
            'invitation': invitation.to_dict()
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@collaboration_bp.route('/invitations/<invitation_id>', methods=['GET'])
def get_invitation_details(invitation_id):
    """Get invitation details (public endpoint for invitation links)."""
    try:
        invitation = collaboration_service.get_invitation_by_id(invitation_id)
        if not invitation:
            return jsonify({'error': 'Invitation not found'}), 404
        
        if invitation.is_expired():
            return jsonify({'error': 'Invitation has expired'}), 410
        
        return jsonify({
            'invitation': invitation.to_dict()
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@collaboration_bp.route('/invitations/<invitation_id>/accept', methods=['POST'])
@require_auth
def accept_invitation(current_user, invitation_id):
    """Accept an invitation."""
    try:
        permission = collaboration_service.accept_invitation(invitation_id, current_user.id)
        if not permission:
            return jsonify({'error': 'Invitation not found or expired'}), 404
        
        return jsonify({
            'message': 'Invitation accepted successfully',
            'permission': permission.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@collaboration_bp.route('/invitations/<invitation_id>/decline', methods=['POST'])
@require_auth
def decline_invitation(current_user, invitation_id):
    """Decline an invitation."""
    try:
        invitation = collaboration_service.decline_invitation(invitation_id)
        if not invitation:
            return jsonify({'error': 'Invitation not found'}), 404
        
        return jsonify({
            'message': 'Invitation declined successfully',
            'invitation': invitation.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@collaboration_bp.route('/canvas/<canvas_id>/collaborators', methods=['GET'])
@require_auth
def get_collaborators(current_user, canvas_id):
    """Get all collaborators for a canvas."""
    try:
        # Check permission
        if not canvas_service.check_canvas_permission(canvas_id, current_user.id):
            return jsonify({'error': 'Access denied'}), 403
        
        collaborators = collaboration_service.get_canvas_collaborators(canvas_id)
        return jsonify({
            'collaborators': collaborators
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@collaboration_bp.route('/canvas/<canvas_id>/collaborators/<user_id>', methods=['PUT'])
@require_auth
def update_collaborator_permission(current_user, canvas_id, user_id):
    """Update a collaborator's permission."""
    try:
        # Check if user is owner
        canvas = canvas_service.get_canvas_by_id(canvas_id)
        if not canvas or canvas.owner_id != current_user.id:
            return jsonify({'error': 'Only the owner can update permissions'}), 403
        
        data = request.get_json()
        new_permission_type = data.get('permission_type')
        
        if not new_permission_type:
            return jsonify({'error': 'permission_type is required'}), 400
        
        # Validate permission type
        valid_permissions = ['view', 'edit']
        if new_permission_type not in valid_permissions:
            return jsonify({'error': f'Invalid permission type. Must be one of: {valid_permissions}'}), 400
        
        permission = collaboration_service.update_collaborator_permission(
            canvas_id=canvas_id,
            user_id=user_id,
            new_permission_type=new_permission_type,
            updated_by=current_user.id
        )
        
        if not permission:
            return jsonify({'error': 'Collaborator not found'}), 404
        
        return jsonify({
            'message': 'Permission updated successfully',
            'permission': permission.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@collaboration_bp.route('/canvas/<canvas_id>/collaborators/<user_id>', methods=['DELETE'])
@require_auth
def remove_collaborator(current_user, canvas_id, user_id):
    """Remove a collaborator from a canvas."""
    try:
        # Check if user is owner
        canvas = canvas_service.get_canvas_by_id(canvas_id)
        if not canvas or canvas.owner_id != current_user.id:
            return jsonify({'error': 'Only the owner can remove collaborators'}), 403
        
        success = collaboration_service.remove_collaborator(canvas_id, user_id)
        if not success:
            return jsonify({'error': 'Collaborator not found'}), 404
        
        return jsonify({
            'message': 'Collaborator removed successfully'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@collaboration_bp.route('/presence/update', methods=['POST'])
@require_auth
@collaboration_rate_limit('presence_update')
@swag_from({
    'tags': ['Collaboration'],
    'summary': 'Update user presence status',
    'description': 'Update the current user\'s presence status and activity on a canvas',
    'security': [{'Bearer': []}],
    'parameters': [
        {
            'name': 'body',
            'in': 'body',
            'required': True,
            'schema': {
                'type': 'object',
                'properties': {
                    'canvas_id': {
                        'type': 'string',
                        'description': 'ID of the canvas'
                    },
                    'status': {
                        'type': 'string',
                        'enum': ['online', 'away', 'busy', 'offline'],
                        'description': 'User presence status'
                    },
                    'activity': {
                        'type': 'string',
                        'enum': ['viewing', 'editing', 'drawing', 'idle'],
                        'description': 'User activity description'
                    },
                    'timestamp': {
                        'type': 'number',
                        'description': 'Timestamp of the update'
                    }
                },
                'required': ['canvas_id', 'status']
            }
        }
    ],
    'responses': {
        200: {
            'description': 'Presence updated successfully',
            'schema': {
                'type': 'object',
                'properties': {
                    'message': {'type': 'string'},
                    'presence': {
                        'type': 'object',
                        'properties': {
                            'user_id': {'type': 'string'},
                            'canvas_id': {'type': 'string'},
                            'status': {'type': 'string'},
                            'activity': {'type': 'string'},
                            'timestamp': {'type': 'number'}
                        }
                    }
                }
            }
        },
        400: {
            'description': 'Bad request - invalid data',
            'schema': {
                'type': 'object',
                'properties': {
                    'error': {'type': 'string'},
                    'details': {'type': 'object'}
                }
            }
        },
        403: {
            'description': 'Access denied - insufficient permissions',
            'schema': {
                'type': 'object',
                'properties': {
                    'error': {'type': 'string'}
                }
            }
        },
        429: {
            'description': 'Rate limit exceeded',
            'schema': {
                'type': 'object',
                'properties': {
                    'error': {'type': 'string'},
                    'retry_after': {'type': 'number'}
                }
            }
        }
    }
})
def update_presence(current_user):
    """Update user presence status with comprehensive security validation."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400
        
        # Validate input using comprehensive schema
        schema = PresenceUpdateSchema()
        try:
            validated_data = schema.load(data)
        except ValidationError as e:
            return jsonify({'error': 'Validation failed', 'details': e.messages}), 400
        
        canvas_id = validated_data['canvas_id']
        status = validated_data['status']
        activity = validated_data.get('activity')
        timestamp = validated_data.get('timestamp')
        
        # Additional security validations
        from app.utils.validators import InputValidator
        
        # Validate canvas ID format and length
        try:
            canvas_id = InputValidator.validate_canvas_id(canvas_id)
        except ValidationError as e:
            return jsonify({'error': f'Invalid canvas ID: {str(e)}'}), 400
        
        # Validate status enum
        try:
            status = InputValidator.validate_enum_value(
                status, 'status', ['online', 'away', 'busy', 'offline']
            )
        except ValidationError as e:
            return jsonify({'error': str(e)}), 400
        
        # Validate activity enum if provided
        if activity:
            try:
                activity = InputValidator.validate_enum_value(
                    activity, 'activity', ['viewing', 'editing', 'drawing', 'idle']
                )
            except ValidationError as e:
                return jsonify({'error': str(e)}), 400
        
        # Check canvas access permission
        if not canvas_service.check_canvas_permission(canvas_id, current_user.id):
            return jsonify({'error': 'Access denied to canvas'}), 403
        
        # Sanitize activity description if provided
        if activity:
            activity = SanitizationService.sanitize_text(activity, max_length=100)
        
        # Update presence through collaboration service
        presence_data = collaboration_service.update_user_presence(
            user_id=current_user.id,
            canvas_id=canvas_id,
            status=status,
            activity=activity,
            timestamp=timestamp
        )
        
        return jsonify({
            'message': 'Presence updated successfully',
            'presence': presence_data
        }), 200
        
    except ValidationError as e:
        return jsonify({'error': 'Validation failed', 'details': str(e)}), 400
    except Exception as e:
        # Secure error handling - don't expose internal details
        return jsonify({'error': 'Internal server error'}), 500

