// API.js 
const API_BASE_URL = '/api';
const COMMENTS_ENDPOINT = `${API_BASE_URL}/comments`;

// Fetch all comments from the API
async function fetchComments() {
  try {
    const response = await fetch(COMMENTS_ENDPOINT);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching comments:', error);
    return [];
  }
}

// Reject a comment
async function rejectComment(commentId) {
  try {
    const response = await fetch(`${COMMENTS_ENDPOINT}/${commentId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error rejecting comment:', error);
    throw error;
  }
}

// Approve a comment
async function approveComment(commentId) {
  try {
    const response = await fetch(`${COMMENTS_ENDPOINT}/${commentId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Error approving comment:', error);
    throw error;
  }
}

// Post comment by ID (if you need this endpoint separately)
async function postComment(commentId) {
  try {
    const response = await fetch(`${COMMENTS_ENDPOINT}/${commentId}/comment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error posting comment by id:', error);
    throw error;
  }
}

// Update a comment's text
async function updateComment(commentId, commentText) {
  try {
    const response = await fetch(`${COMMENTS_ENDPOINT}/${commentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ comment: commentText }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error updating comment text:', error);
    throw error;
  }
}

// Generate a new comment for a post
async function generateComment(postId, caption) {
  try {
    const response = await fetch(`${COMMENTS_ENDPOINT}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ postId, caption }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error generating new comment:', error);
    throw error;
  }
}

// Set a comment's status to "in progress"
async function setInProgress(commentId) {
  try {
    const response = await fetch(`${COMMENTS_ENDPOINT}/${commentId}/in-progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error setting comment to in progress:', error);
    throw error;
  }
}

// ----------------------------------------
// Nouvelle fonction : Instagram Login
// ----------------------------------------
async function instagramLogin() {
  try {
    const response = await fetch(`${COMMENTS_ENDPOINT}/instagram/login`, { 
      method: 'POST' 
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error during Instagram login:', error);
    throw error;
  }
}

// Export API functions
window.api = {
  fetchComments,
  rejectComment,
  approveComment,
  postComment,
  updateComment,
  generateComment,
  setInProgress,
  instagramLogin,  // Ajout de la fonction dans l'objet exporté
};
