import uuid
import json
from datetime import datetime
from app.models import Canvas, CanvasObject, CanvasPermission, User
from app.extensions import db
from app.utils.railway_logger import railway_logger

class CanvasService:
    """Canvas related business logic."""
    
    def create_canvas(self, title, description, owner_id, is_public=False):
        """Create a new canvas."""
        canvas = Canvas(
            id=str(uuid.uuid4()),
            title=title,
            description=description,
            owner_id=owner_id,
            is_public=is_public
        )
        
        db.session.add(canvas)
        db.session.commit()
        
        return canvas
    
    def get_canvas_by_id(self, canvas_id):
        """Get canvas by ID."""
        return Canvas.query.filter_by(id=canvas_id).first()
    
    def get_user_canvases(self, user_id):
        """Get all canvases accessible to a user."""
        # Get owned canvases
        owned_canvases = Canvas.query.filter_by(owner_id=user_id).all()
        
        # Get canvases with permissions
        permission_canvases = Canvas.query.join(CanvasPermission).filter(
            CanvasPermission.user_id == user_id
        ).all()
        
        # Get public canvases
        public_canvases = Canvas.query.filter_by(is_public=True).all()
        
        # Combine and deduplicate
        all_canvases = list(set(owned_canvases + permission_canvases + public_canvases))
        
        return all_canvases
    
    def update_canvas(self, canvas_id, **kwargs):
        """Update canvas properties."""
        canvas = self.get_canvas_by_id(canvas_id)
        if not canvas:
            return None
        
        for key, value in kwargs.items():
            if hasattr(canvas, key):
                setattr(canvas, key, value)
        
        canvas.updated_at = datetime.utcnow()
        db.session.commit()
        
        return canvas
    
    def delete_canvas(self, canvas_id):
        """Delete a canvas."""
        canvas = self.get_canvas_by_id(canvas_id)
        if not canvas:
            return False
        
        db.session.delete(canvas)
        db.session.commit()
        
        return True
    
    def check_canvas_permission(self, canvas_id, user_id, permission_type='view'):
        """Check if user has permission on canvas."""
        print(f"=== Permission Check Debug ===")
        print(f"Canvas ID: {canvas_id}")
        print(f"User ID: {user_id}")
        print(f"Permission type: {permission_type}")
        
        canvas = self.get_canvas_by_id(canvas_id)
        if not canvas:
            print("Canvas not found in permission check")
            return False
        
        print(f"Canvas owner ID: {canvas.owner_id}")
        print(f"Canvas is public: {canvas.is_public}")
        
        # Owner has all permissions
        if canvas.owner_id == user_id:
            print("User is owner - permission granted")
            return True
        
        # Check if canvas is public (view permission only)
        if canvas.is_public and permission_type == 'view':
            return True
        
        # Check explicit permissions
        permission = CanvasPermission.query.filter_by(
            canvas_id=canvas_id,
            user_id=user_id,
            permission_type=permission_type
        ).first()
        
        return permission is not None
    
    def create_canvas_object(self, canvas_id, object_type, properties, created_by, z_index_behavior='top'):
        """Create a new canvas object with comprehensive validation and z-index management."""
        try:
            # Validate canvas exists
            canvas = self.get_canvas_by_id(canvas_id)
            if not canvas:
                railway_logger.log('canvas', 40, f"Canvas not found: {canvas_id}")
                raise ValueError(f"Canvas not found: {canvas_id}")
            
            # Validate user exists
            user = User.query.filter_by(id=created_by).first()
            if not user:
                railway_logger.log('canvas', 40, f"User not found: {created_by}")
                raise ValueError(f"User not found: {created_by}")
            
            # Validate object type
            valid_types = ['rectangle', 'circle', 'text', 'heart', 'star', 'diamond', 'line', 'arrow']
            if object_type not in valid_types:
                railway_logger.log('canvas', 40, f"Invalid object type: {object_type}")
                raise ValueError(f"Invalid object type: {object_type}")
            
            # Validate properties
            if isinstance(properties, str):
                try:
                    properties_dict = json.loads(properties)
                except json.JSONDecodeError as e:
                    railway_logger.log('canvas', 40, f"Invalid JSON in properties: {str(e)}")
                    raise ValueError(f"Invalid JSON in properties: {str(e)}")
            elif isinstance(properties, dict):
                properties_dict = properties
            else:
                railway_logger.log('canvas', 40, f"Properties must be dict or JSON string: {type(properties)}")
                raise ValueError(f"Properties must be dict or JSON string: {type(properties)}")
            
            # Validate properties structure based on object type
            self._validate_object_properties(object_type, properties_dict)
            
            # Calculate z-index based on behavior
            z_index = self._calculate_z_index(canvas_id, properties_dict, z_index_behavior)
            
            # Create canvas object
            canvas_object = CanvasObject(
                id=str(uuid.uuid4()),
                canvas_id=canvas_id,
                object_type=object_type,
                properties=json.dumps(properties_dict) if isinstance(properties_dict, dict) else properties,
                z_index=z_index,
                created_by=created_by
            )
            
            db.session.add(canvas_object)
            db.session.commit()
            
            railway_logger.log('canvas', 10, f"Canvas object created: {canvas_object.id} of type {object_type} with z-index {z_index}")
            return canvas_object
            
        except Exception as e:
            db.session.rollback()
            railway_logger.log('canvas', 40, f"Failed to create canvas object: {str(e)}")
            raise e
    
    def _validate_object_properties(self, object_type, properties):
        """Validate object properties based on type."""
        try:
            if object_type in ['rectangle', 'circle', 'star', 'diamond']:
                # Validate required coordinates
                if 'x' not in properties or 'y' not in properties:
                    raise ValueError(f"{object_type} requires x and y coordinates")
                
                # Validate coordinate types and ranges
                x, y = properties['x'], properties['y']
                if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
                    raise ValueError(f"{object_type} coordinates must be numeric")
                
                if abs(x) > 10000 or abs(y) > 10000:
                    raise ValueError(f"{object_type} coordinates out of range")
            
            elif object_type in ['line', 'arrow']:
                # Validate line/arrow coordinates - support both formats
                if 'points' in properties:
                    # Frontend format: points array [x1, y1, x2, y2]
                    points = properties['points']
                    if not isinstance(points, list) or len(points) != 4:
                        raise ValueError(f"{object_type} requires points array with 4 values [x1, y1, x2, y2]")
                    
                    for i, point in enumerate(points):
                        if not isinstance(point, (int, float)):
                            raise ValueError(f"{object_type} points[{i}] must be numeric")
                        if abs(point) > 10000:
                            raise ValueError(f"{object_type} points[{i}] out of range")
                else:
                    # Backend format: x1, y1, x2, y2 coordinates
                    required_coords = ['x1', 'y1', 'x2', 'y2']
                    for coord in required_coords:
                        if coord not in properties:
                            raise ValueError(f"{object_type} requires {coord} coordinate or points array")
                        
                        if not isinstance(properties[coord], (int, float)):
                            raise ValueError(f"{object_type} {coord} must be numeric")
                        
                        if abs(properties[coord]) > 10000:
                            raise ValueError(f"{object_type} {coord} out of range")
            
            elif object_type == 'text':
                # Validate text content
                if 'text' not in properties:
                    raise ValueError("Text object requires text property")
                
                if not isinstance(properties['text'], str):
                    raise ValueError("Text property must be string")
                
                if len(properties['text']) > 1000:
                    raise ValueError("Text too long (max 1000 characters)")
            
            # Validate common properties
            if 'width' in properties:
                width = properties['width']
                if not isinstance(width, (int, float)) or width <= 0 or width > 5000:
                    raise ValueError("Invalid width value")
            
            if 'height' in properties:
                height = properties['height']
                if not isinstance(height, (int, float)) or height <= 0 or height > 5000:
                    raise ValueError("Invalid height value")
            
            if 'color' in properties:
                color = properties['color']
                if not isinstance(color, str) or len(color) > 50:
                    raise ValueError("Invalid color value")
            
        except Exception as e:
            railway_logger.log('canvas', 40, f"Object properties validation failed: {str(e)}")
            raise e
    
    def _calculate_z_index(self, canvas_id, properties, behavior='top'):
        """Calculate z-index for new object based on behavior and existing objects."""
        try:
            # Get all existing objects on the canvas
            existing_objects = self.get_canvas_objects(canvas_id)
            
            if not existing_objects:
                return 0  # First object gets z-index 0
            
            # Get position from properties
            position = self._extract_position(properties)
            if not position:
                # If no position, just use top behavior
                return max(obj.z_index for obj in existing_objects) + 1
            
            # Find overlapping objects (within 50 pixels)
            overlapping_objects = []
            for obj in existing_objects:
                obj_props = obj.get_properties()
                obj_position = self._extract_position(obj_props)
                if obj_position and self._is_overlapping(position, obj_position, threshold=50):
                    overlapping_objects.append(obj)
            
            if behavior == 'top':
                # Always place on top
                return max(obj.z_index for obj in existing_objects) + 1
            elif behavior == 'bottom':
                # Always place at bottom
                return min(obj.z_index for obj in existing_objects) - 1
            elif behavior == 'smart':
                # Place above overlapping objects, below non-overlapping
                if overlapping_objects:
                    max_overlapping_z = max(obj.z_index for obj in overlapping_objects)
                    return max_overlapping_z + 1
                else:
                    # No overlapping objects, place at top
                    return max(obj.z_index for obj in existing_objects) + 1
            else:
                # Default to top
                return max(obj.z_index for obj in existing_objects) + 1
                
        except Exception as e:
            railway_logger.log('canvas', 40, f"Z-index calculation failed: {str(e)}")
            # Fallback to top behavior
            existing_objects = self.get_canvas_objects(canvas_id)
            if existing_objects:
                return max(obj.z_index for obj in existing_objects) + 1
            return 0
    
    def _extract_position(self, properties):
        """Extract position from object properties."""
        if 'x' in properties and 'y' in properties:
            return {'x': properties['x'], 'y': properties['y']}
        elif 'x1' in properties and 'y1' in properties:
            return {'x': properties['x1'], 'y': properties['y1']}
        return None
    
    def _is_overlapping(self, pos1, pos2, threshold=50):
        """Check if two positions are overlapping within threshold."""
        if not pos1 or not pos2:
            return False
        distance = ((pos1['x'] - pos2['x']) ** 2 + (pos1['y'] - pos2['y']) ** 2) ** 0.5
        return distance < threshold
    
    def get_canvas_objects(self, canvas_id):
        """Get all objects for a canvas."""
        return CanvasObject.query.filter_by(canvas_id=canvas_id).all()
    
    def update_canvas_object(self, object_id, **kwargs):
        """Update canvas object properties."""
        canvas_object = CanvasObject.query.filter_by(id=object_id).first()
        if not canvas_object:
            return None
        
        for key, value in kwargs.items():
            if hasattr(canvas_object, key):
                setattr(canvas_object, key, value)
        
        canvas_object.updated_at = datetime.utcnow()
        db.session.commit()
        
        return canvas_object
    
    def delete_canvas_object(self, object_id):
        """Delete a canvas object."""
        canvas_object = CanvasObject.query.filter_by(id=object_id).first()
        if not canvas_object:
            return False
        
        db.session.delete(canvas_object)
        db.session.commit()
        
        return True
    
    def update_object_z_index(self, object_id, z_index):
        """Update object z-index."""
        canvas_object = CanvasObject.query.filter_by(id=object_id).first()
        if not canvas_object:
            return None
        
        canvas_object.z_index = z_index
        canvas_object.updated_at = datetime.utcnow()
        db.session.commit()
        
        return canvas_object
    
    def bring_object_to_front(self, object_id):
        """Bring object to front (highest z-index)."""
        canvas_object = CanvasObject.query.filter_by(id=object_id).first()
        if not canvas_object:
            return None
        
        # Get all objects on the same canvas
        canvas_objects = self.get_canvas_objects(canvas_object.canvas_id)
        if not canvas_objects:
            return canvas_object
        
        # Set to highest z-index + 1
        max_z_index = max(obj.z_index for obj in canvas_objects)
        canvas_object.z_index = max_z_index + 1
        canvas_object.updated_at = datetime.utcnow()
        db.session.commit()
        
        return canvas_object
    
    def send_object_to_back(self, object_id):
        """Send object to back (lowest z-index)."""
        canvas_object = CanvasObject.query.filter_by(id=object_id).first()
        if not canvas_object:
            return None
        
        # Get all objects on the same canvas
        canvas_objects = self.get_canvas_objects(canvas_object.canvas_id)
        if not canvas_objects:
            return canvas_object
        
        # Set to lowest z-index - 1
        min_z_index = min(obj.z_index for obj in canvas_objects)
        canvas_object.z_index = min_z_index - 1
        canvas_object.updated_at = datetime.utcnow()
        db.session.commit()
        
        return canvas_object
    
    def move_object_up(self, object_id):
        """Move object up one layer."""
        canvas_object = CanvasObject.query.filter_by(id=object_id).first()
        if not canvas_object:
            return None
        
        canvas_object.z_index += 1
        canvas_object.updated_at = datetime.utcnow()
        db.session.commit()
        
        return canvas_object
    
    def move_object_down(self, object_id):
        """Move object down one layer."""
        canvas_object = CanvasObject.query.filter_by(id=object_id).first()
        if not canvas_object:
            return None
        
        canvas_object.z_index -= 1
        canvas_object.updated_at = datetime.utcnow()
        db.session.commit()
        
        return canvas_object
