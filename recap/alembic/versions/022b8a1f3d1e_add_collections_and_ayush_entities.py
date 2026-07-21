"""add collections and ayush_entities

Revision ID: 022b8a1f3d1e
Revises: cf7f9c740d00
Create Date: 2026-06-29 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = '022b8a1f3d1e'
down_revision: Union[str, None] = 'cf7f9c740d00'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add ayush_entities column to papers table
    op.add_column('papers', sa.Column('ayush_entities', sa.Text, nullable=True))

    # Create collections table
    op.create_table(
        'collections',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('name', sa.String, nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('is_public', sa.Boolean, nullable=False, server_default=sa.text('false')),
        sa.Column('hypothesis_seed', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('now()'))
    )

    # Create collection_papers table
    op.create_table(
        'collection_papers',
        sa.Column('collection_id', UUID(as_uuid=True), sa.ForeignKey('collections.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('paper_id', UUID(as_uuid=True), sa.ForeignKey('papers.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('added_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('notes', sa.Text, nullable=True)
    )

    # Create indexes
    op.create_index('ix_collections_user_id', 'collections', ['user_id'])
    op.create_index('ix_collection_papers_paper_id', 'collection_papers', ['paper_id'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_collection_papers_paper_id', table_name='collection_papers')
    op.drop_index('ix_collections_user_id', table_name='collections')

    # Drop tables
    op.drop_table('collection_papers')
    op.drop_table('collections')

    # Remove ayush_entities column from papers
    op.drop_column('papers', 'ayush_entities')