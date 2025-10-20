"""Add Prompt model and Canvas.prompt_id foreign key

Revision ID: 001_add_prompt_model
Revises: 
Create Date: 2025-10-20

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime


# revision identifiers, used by Alembic.
revision = '001_add_prompt_model'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Create prompts table
    op.create_table('prompts',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=128), nullable=False),
        sa.Column('instructions', sa.Text(), nullable=False),
        sa.Column('style', sa.String(length=50), nullable=True),
        sa.Column('color_scheme', sa.String(length=50), nullable=True),
        sa.Column('model_used', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('request_metadata', sa.Text(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Add prompt_id column to canvases table
    op.add_column('canvases', sa.Column('prompt_id', sa.String(length=36), nullable=True))
    op.create_foreign_key('fk_canvases_prompt_id', 'canvases', 'prompts', ['prompt_id'], ['id'])
    
    # Create indexes for performance
    op.create_index('ix_prompts_user_id', 'prompts', ['user_id'])
    op.create_index('ix_prompts_status', 'prompts', ['status'])
    op.create_index('ix_canvases_prompt_id', 'canvases', ['prompt_id'])


def downgrade():
    # Drop indexes
    op.drop_index('ix_canvases_prompt_id', table_name='canvases')
    op.drop_index('ix_prompts_status', table_name='prompts')
    op.drop_index('ix_prompts_user_id', table_name='prompts')
    
    # Remove prompt_id from canvases
    op.drop_constraint('fk_canvases_prompt_id', 'canvases', type_='foreignkey')
    op.drop_column('canvases', 'prompt_id')
    
    # Drop prompts table
    op.drop_table('prompts')
