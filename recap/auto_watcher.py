#!/usr/bin/env python3
"""
AUTO-WATCHER SERVICE - Runs 24/7 to auto-chunk and auto-embed new papers
"""

import time
import logging
import sys
import os
from datetime import datetime

# Add path
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app.models import Paper
from app.services.embedding_service import embed_new_papers

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('auto_watcher.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class AutoWatcher:
    def __init__(self, check_interval=10):
        self.check_interval = check_interval
        self.is_running = True
        
    def get_unprocessed_count(self):
        """Get count of papers without chunks"""
        db = SessionLocal()
        try:
            count = db.query(Paper).filter(~Paper.chunks.any()).count()
            return count
        except Exception as e:
            logger.error(f"Error counting unprocessed: {e}")
            return 0
        finally:
            db.close()
    
    def process_pending_papers(self):
        """Process all papers without chunks"""
        try:
            unprocessed = self.get_unprocessed_count()
            
            if unprocessed == 0:
                logger.info("✅ No pending papers - all processed!")
                return
            
            logger.info(f"🔍 Found {unprocessed} papers without chunks")
            logger.info("🔄 Starting auto-embedding...")
            
            embed_new_papers()
            
            remaining = self.get_unprocessed_count()
            if remaining > 0:
                logger.warning(f"⚠️ {remaining} papers still pending - will retry")
            else:
                logger.info("✅ All papers processed successfully!")
                
        except Exception as e:
            logger.error(f"❌ Error processing papers: {e}")
    
    def run(self):
        """Main loop - runs forever"""
        logger.info("🚀 AUTO-WATCHER STARTED")
        logger.info(f"⏱️  Checking every {self.check_interval} seconds")
        logger.info(f"📊 Initial pending papers: {self.get_unprocessed_count()}")
        
        while self.is_running:
            try:
                pending = self.get_unprocessed_count()
                
                if pending > 0:
                    logger.info(f"📝 Found {pending} papers waiting for processing")
                    self.process_pending_papers()
                
                time.sleep(self.check_interval)
                
            except KeyboardInterrupt:
                logger.info("👋 Shutting down gracefully...")
                self.is_running = False
                break
            except Exception as e:
                logger.error(f"❌ Watcher error: {e}")
                time.sleep(60)

if __name__ == "__main__":
    watcher = AutoWatcher(check_interval=10)
    watcher.run()