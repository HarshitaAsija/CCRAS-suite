from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Table, UUID, text, ARRAY, JSON,Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid

Base = declarative_base()

paper_author = Table(
    'paper_authors',
    Base.metadata,
    Column('paper_id', UUID, ForeignKey('papers.id')),
    Column('author_id', Integer, ForeignKey('authors.id'))
)

collection_paper = Table(
    'collection_papers',
    Base.metadata,
    Column('collection_id', Integer, ForeignKey('collections.id')),
    Column('paper_id', UUID, ForeignKey('papers.id'))
)

class Paper(Base):
    __tablename__ = 'papers'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    title = Column(Text, nullable=False)
    abstract = Column(Text)
    authors = Column(JSON)
    published_date = Column(DateTime)
    publication_date = Column(DateTime)      
    published_date = Column(Text)            
    journal = Column(Text)
    doi = Column(String, unique=True, index=True, nullable=True)
    pmid = Column(String)
    keywords = Column(JSON)  # plain JSON column — NOT a relationship
    full_text = Column(Text)
    source = Column(String)
    jats_xml = Column(Text)
    ocr_text = Column(Text)
    language = Column(String)
    word_count = Column(Integer)
    citation_count = Column(Integer)        
    citations = Column(JSON)                
    paper_references = Column(JSON)          
    status = Column(String)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    processing_status = Column(String(30), default='pending')
    processing_error = Column(Text, nullable=True)
    chunked_at = Column(DateTime, nullable=True)
    embedded_at = Column(DateTime, nullable=True)
    processed_at = Column(DateTime, nullable=True)
    embedding = Column(Vector(768))

    # Relationships
    authors_rel = relationship("Author", secondary=paper_author, back_populates="papers")
    collections = relationship("Collection", secondary=collection_paper, back_populates="papers")  # fixed
    chunks = relationship("PaperChunk", back_populates="paper", cascade="all, delete-orphan")
    keyword_records = relationship("Keyword", back_populates="paper")  # added

class Author(Base):
    __tablename__ = 'authors'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    orcid = Column(String, unique=True, index=True)

    papers = relationship("Paper", secondary=paper_author, back_populates="authors_rel")

class Keyword(Base):
    __tablename__ = 'keywords'

    id = Column(Integer, primary_key=True, index=True)
    paper_id = Column(UUID, ForeignKey('papers.id'))
    keyword = Column(String, nullable=False)
    score = Column(Integer)

    # Fixed: back_populates now points to keyword_records on Paper
    paper = relationship("Paper", back_populates="keyword_records")

class PaperChunk(Base):
    __tablename__ = 'paper_chunks'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    paper_id = Column(UUID, ForeignKey('papers.id'), nullable=False)
    chunk_text = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    embedding = Column(Vector(384))

    paper = relationship("Paper", back_populates="chunks")

class Collection(Base):
    __tablename__ = 'collections'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(UUID, ForeignKey('users.id'), nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=func.now())

    user = relationship("User", back_populates="collections")
    papers = relationship("Paper", secondary=collection_paper, back_populates="collections")  # fixed

class User(Base):
    __tablename__ = 'users'

    id = Column(UUID, primary_key=True, index=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    name = Column(String)
    role = Column(String)
    status = Column(String)
    avatar = Column(Text)
    phone = Column(String)
    department = Column(String)
    designation = Column(String)
    last_login = Column(DateTime)
    password_reset_token = Column(String)
    password_reset_expires = Column(DateTime)
    email_verified = Column(Boolean, default=False)

    # Relationships
    collections = relationship("Collection", back_populates="user")
    chat_sessions = relationship("ChatSession", back_populates="user")
    chat_messages = relationship("ChatMessage", back_populates="user")
    
    
class ChatSession(Base):
    __tablename__ = 'chat_sessions'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID, ForeignKey('users.id'), nullable=False)
    title = Column(String, nullable=False)
    created_at = Column(DateTime, default=func.now())

    user = relationship("User", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = 'chat_messages'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    session_id = Column(UUID, ForeignKey('chat_sessions.id'), nullable=False)
    user_id = Column(UUID, ForeignKey('users.id'), nullable=False)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    cited_paper_ids = Column(ARRAY(UUID), nullable=True)
    created_at = Column(DateTime, default=func.now())

    session = relationship("ChatSession", back_populates="messages")
    user = relationship("User", back_populates="chat_messages")