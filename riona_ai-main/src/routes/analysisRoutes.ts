import { Router, Request, Response } from 'express';
import { processAnalysisQueue } from '../controllers/analyse';
import logger from '../config/logger';
import { processLinkedInAnalysisQueue } from '../controllers/analysislink';
const router = Router();
router.post('/analyze-comments', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username } = req.body;
    
    if (!username) {
      res.status(400).json({ 
        error: 'Username is required' 
      });
      return;
    }

    // Validate username is a string and not empty
    if (typeof username !== 'string' || username.trim().length === 0) {
      res.status(400).json({ 
        error: 'Username must be a non-empty string' 
      });
      return;
    }

    logger.info(`Starting comment analysis for username: ${username}`);

    // Start analysis in background (non-blocking)
    processLinkedInAnalysisQueue(username.trim()).catch(error => {
      logger.error(`Analysis process failed for ${username}:`, error);
    });

    res.json({ 
      message: `Comment analysis started for ${username}`,
      status: 'started',
      username: username.trim(),
      timestamp: new Date().toISOString(),
      note: 'Analysis is running in the background. Check logs for progress updates.'
    });

  } catch (error: any) {
    logger.error('Error starting comment analysis:', error);
    res.status(500).json({ 
      error: 'Failed to start comment analysis',
      message: error?.message || 'Unknown error occurred'
    });
  }
});
// Start comment analysis for a specific username
router.post('/analyze-posted-comments', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username } = req.body;
    
    if (!username) {
      res.status(400).json({ 
        error: 'Username is required' 
      });
      return;
    }

    // Validate username is a string and not empty
    if (typeof username !== 'string' || username.trim().length === 0) {
      res.status(400).json({ 
        error: 'Username must be a non-empty string' 
      });
      return;
    }

    logger.info(`Starting comment analysis for username: ${username}`);

    // Start analysis in background (non-blocking)
    processAnalysisQueue(username.trim()).catch(error => {
      logger.error(`Analysis process failed for ${username}:`, error);
    });

    res.json({ 
      message: `Comment analysis started for ${username}`,
      status: 'started',
      username: username.trim(),
      timestamp: new Date().toISOString(),
      note: 'Analysis is running in the background. Check logs for progress updates.'
    });

  } catch (error: any) {
    logger.error('Error starting comment analysis:', error);
    res.status(500).json({ 
      error: 'Failed to start comment analysis',
      message: error?.message || 'Unknown error occurred'
    });
  }
});

export default router;