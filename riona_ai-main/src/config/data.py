# config/db.py
import os
from pymongo import MongoClient
from pymongo.database import Database
from pymongo.collection import Collection
from datetime import datetime
from typing import Dict, Any, Optional, List
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup logging
logger = logging.getLogger(__name__)

url = os.environ['MONGODB_URI']
client = MongoClient(url)
db: Optional[Database] = None

async def connect_to_database() -> Dict[str, Database]:
    """Connect to MongoDB database and ensure collections exist"""
    global db
    
    if db is not None:
        return {'db': db}
    
    try:
        # Test connection
        client.admin.command('ping')
        
        db_name = os.environ.get('DB_NAME', 'riona')
        db = client[db_name]
        
        # Ensure collections exist
        existing_collections = db.list_collection_names()
        
        for name in ['users', 'comments', 'accounts']:
            if name not in existing_collections:
                db.create_collection(name)
                logger.info(f'Created collection {name}')
        
        logger.info('Connected to MongoDB')
        return {'db': db}
        
    except Exception as error:
        logger.error(f'Failed to connect to database: {error}')
        raise error

def get_user_collection_by_user_id(user_id: str) -> Collection:
    """Get user-specific collection by user ID"""
    if db is None:
        raise Exception('DB not initialized')
    return db[f'user_{user_id}']

def get_users_collection() -> Collection:
    """Get users collection"""
    if db is None:
        raise Exception('DB not initialized')
    return db['users']

def get_comments_collection() -> Collection:
    """Get comments collection"""
    if db is None:
        raise Exception('DB not initialized')
    return db['comments']

def get_accounts_collection() -> Collection:
    """Get accounts collection"""
    if db is None:
        raise Exception('DB not initialized')
    return db['accounts']

async def upsert_account(user_id: str, platform: str, username: str) -> str:
    """
    Create or retrieve an account document for this user/platform/username combo.
    Returns the account's Mongo _id as a string.
    """
    global db
    
    if db is None:
        await connect_to_database()
    
    accounts = get_accounts_collection()
    
    # Use find_one_and_update for upsert operation
    result = accounts.find_one_and_update(
        {'userId': user_id, 'platform': platform, 'username': username},
        {
            '$set': {
                'userId': user_id,
                'platform': platform,
                'username': username,
                'updatedAt': datetime.now()
            }
        },
        upsert=True,
        return_document=True  # Returns the document after update
    )
    
    if not result or '_id' not in result:
        raise Exception('Failed to upsert account')
    
    return str(result['_id'])

async def save_comment(comment_data: Dict[str, Any]) -> str:
    """
    Save a comment to the database.
    Returns the comment's Mongo _id as a string.
    """
    global db
    
    if db is None:
        await connect_to_database()
    
    comments = get_comments_collection()
    
    # Add timestamps
    comment_document = {
        **comment_data,
        'createdAt': datetime.now(),
        'updatedAt': datetime.now()
    }
    
    try:
        result = comments.insert_one(comment_document)
        logger.info(f'Comment saved with ID: {result.inserted_id}')
        return str(result.inserted_id)
    except Exception as error:
        logger.error(f'Failed to save comment: {error}')
        raise error