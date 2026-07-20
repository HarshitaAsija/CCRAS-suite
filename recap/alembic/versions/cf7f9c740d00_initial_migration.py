"""initial migration

Revision ID: cf7f9c740d00
Revises:
Create Date: 2026-06-05 09:55:30.432141

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision: str = 'cf7f9c740d00'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')

    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('email', sa.String, unique=True, nullable=False),
        sa.Column('hashed_password', sa.String, nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()'))
    )

    # Create papers table
    op.create_table(
        'papers',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('doi', sa.String, unique=True, nullable=False),
        sa.Column('title', sa.String, nullable=False),
        sa.Column('abstract', sa.Text),
        sa.Column('full_text', sa.Text),
        sa.Column('source', sa.String),
        sa.Column('published_date', sa.DateTime),
        sa.Column('ingested_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('embedding', Vector(768))
    )

    # Create authors table
    op.create_table(
        'authors',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('name', sa.String, nullable=False),
        sa.Column('orcid', sa.String, unique=True)
    )

    # Create paper_authors association table
    op.create_table(
        'paper_authors',
        sa.Column('paper_id', sa.Integer, sa.ForeignKey('papers.id'), primary_key=True),
        sa.Column('author_id', sa.Integer, sa.ForeignKey('authors.id'), primary_key=True)
    )

    # Create keywords table
    op.create_table(
        'keywords',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('paper_id', sa.Integer, sa.ForeignKey('papers.id')),
        sa.Column('keyword', sa.String, nullable=False),
        sa.Column('score', sa.Integer)
    )

    # Create collections table
    op.create_table(
        'collections',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('name', sa.String, nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()'))
    )

    # Create collection_papers association table
    op.create_table(
        'collection_papers',
        sa.Column('collection_id', sa.Integer, sa.ForeignKey('collections.id'), primary_key=True),
        sa.Column('paper_id', sa.Integer, sa.ForeignKey('papers.id'), primary_key=True)
    )

    # Create indexes
    op.create_index('ix_papers_full_text_gin', 'papers', ['full_text'], postgresql_using='gin')
    op.create_index('ix_papers_embedding_hnsw', 'papers', ['embedding'], postgresql_using='hnsw')


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_papers_embedding_hnsw', table_name='papers', postgresql_using='hnsw')
    op.drop_index('ix_papers_full_text_gin', table_name='papers', postgresql_using='gin')

    # Drop tables in reverse order to avoid foreign key constraints
    op.drop_table('collection_papers')
    op.drop_table('collections')
    op.drop_table('keywords')
    op.drop_table('paper_authors')
    op.drop_table('authors')
    op.drop_table('papers')
    op.drop_table('users')

    # Drop pgvector extension
    op.execute('DROP EXTENSION IF EXISTS vector')
