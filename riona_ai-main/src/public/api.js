// Replace the api object in the script section with this updated version
const api = {
  async fetchComments() {
    // Get username from local storage
    const username = stateManager.getUsername();
    
    if (!username) {
      throw new Error('Username not set');
    }
    
    const response = await fetch(`${API_BASE_URL}/comments?username=${encodeURIComponent(username)}`);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return await response.json();
  },
  
  
  async getCommentById(id) {
    const response = await fetch(`${API_BASE_URL}/comments/${id}`);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return await response.json();
  },
  async approveComment(id) {
    const userId = localStorage.getItem('userId');
    const response = await fetch(`${API_BASE_URL}/comments/${id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return await response.json();
  },
  async rejectComment(id) {
    const userId = localStorage.getItem('userId');
    const response = await fetch(`${API_BASE_URL}/comments/${id}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return await response.json();
  },
  async postComment(id) {
    const userId = localStorage.getItem('userId');
    const response = await fetch(`${API_BASE_URL}/comments/${id}/comment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return await response.json();
  },
  async updateComment(id, comment) {
    const userId = localStorage.getItem('userId');
    const response = await fetch(`${API_BASE_URL}/comments/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, comment }),
    });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return await response.json();
  },
  async generateComment(postId, caption) {
    const userId = localStorage.getItem('userId');
    const response = await fetch(`${API_BASE_URL}/comments/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, postId, caption }),
    });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return await response.json();
  },
  async instagramLogin(username) {
    const userId = localStorage.getItem('userId');
    const response = await fetch(`${API_BASE_URL}/instagram/login`, { 
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, username }),
    });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return await response.json();
  },
  async checkLoginStatus() {
    const userId = localStorage.getItem('userId');
    const response = await fetch(`${API_BASE_URL}/instagram/status?userId=${userId}`);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return await response.json();
  },
  async setUsername(username) {
    const userId = localStorage.getItem('userId');
    const response = await fetch(`${API_BASE_URL}/instagram/username`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, username }),
    });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return await response.json();
  }
};

// Replace the saveUsername function with this improved version
async function saveUsername(username) {
  if (!username || username.trim() === '') {
    alert('Please enter a valid Instagram username');
    return;
  }
  
  try {
    // Clean username (remove @ if present)
    username = username.trim().replace(/^@/, '');
    
    // Call API to save username on server
    await api.setUsername(username);
    
    // Save locally
    stateManager.saveUsername(username);
    hasUsername = true;
    
    // Update UI
    updateUIState();
    
    // Reset any username input fields
    document.getElementById('instagramUsername').value = '';
    document.getElementById('modalInstagramUsername').value = '';
    
    // Hide modals if open
    try {
      usernameModal.hide();
    } catch (e) {
      console.log('Modal was not open');
    }
    
  } catch (error) {
    console.error('Error saving username:', error);
    alert(`Error saving username: ${error.message}`);
  }
}

// Update checkInitialState function to use the server status endpoint
async function checkInitialState() {
  try {
    // First check local storage
    const storedState = stateManager.getLoginState();
    const storedUsername = stateManager.getUsername();
    
    // Make sure userId is available for API calls
    if (!localStorage.getItem('userId')) {
      // Generate a simple user ID if not available (in a real app, this would come from authentication)
      localStorage.setItem('userId', 'user_' + Date.now());
    }
    
    // Show loading state
    dataSourceInfo.innerHTML = `
      <div class="alert alert-info">
        <i class="bi bi-hourglass-split"></i> Checking connection status...
      </div>
    `;
    
    // Then verify with server
    const serverStatus = await api.checkLoginStatus();
    
    // Update based on server response
    if (serverStatus.hasAccount) {
      // We have an account record
      hasUsername = true;
      stateManager.saveUsername(serverStatus.username);
      usernameDisplay.textContent = `(@${serverStatus.username})`;
    }
    
    if (serverStatus.loggedIn) {
      // Logged into Instagram
      isLoggedIn = true;
      stateManager.saveLoginState(serverStatus.username);
    } else {
      isLoggedIn = false;
      stateManager.clearLoginState();
    }
    
    // Update UI based on state
    updateUIState();
    
    if (isLoggedIn && hasUsername) {
      loadComments();
    }
  } catch (error) {
    console.error('Error checking initial state:', error);
    
    // If server check fails but we have stored state, still use it
    const storedState = stateManager.getLoginState();
    const storedUsername = stateManager.getUsername();
    
    if (storedState.loggedIn) {
      isLoggedIn = true;
      hasUsername = !!storedUsername;
      
      dataSourceInfo.innerHTML = `
        <div class="alert alert-warning">
          <i class="bi bi-exclamation-triangle"></i> Could not verify login status with server. Using stored credentials.
        </div>
      `;
      
      updateUIState();
      
      if (isLoggedIn && hasUsername) {
        loadComments();
      }
    } else {
      isLoggedIn = false;
      hasUsername = !!storedUsername;
      updateUIState();
      
      dataSourceInfo.innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-triangle"></i> Error checking connection status: ${error.message}
        </div>
      `;
    }
  }
}