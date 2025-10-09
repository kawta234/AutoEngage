document.addEventListener('DOMContentLoaded', function () {
  const commentsContainer = document.getElementById('comments-container');
  const filterButtons = document.querySelectorAll('[data-filter]');
  const editModal = new bootstrap.Modal(document.getElementById('editCommentModal'));
  const newCommentModal = new bootstrap.Modal(document.getElementById('newCommentModal'));
  const usernameModal = new bootstrap.Modal(document.getElementById('usernameModal'));
  const accountsModal = new bootstrap.Modal(document.getElementById('accountsManagementModal'));
  const commentAnalysisModal = new bootstrap.Modal(document.getElementById('commentAnalysisModal'));
  const commentTextArea = document.getElementById('commentText');
  const postCaptionArea = document.getElementById('postCaption');
  const postIdInput = document.getElementById('postId');
  const editCommentIdInput = document.getElementById('editCommentId');
  const saveCommentBtn = document.getElementById('saveCommentBtn');
  const generateCommentBtn = document.getElementById('generateCommentBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const dataSourceInfo = document.getElementById('data-source-info');
  const addNewCommentBtn = document.getElementById('addNewCommentBtn');
  const dropdownLogoutBtn = document.getElementById('dropdownLogoutBtn');
  const linkedinLoginBtn = document.getElementById('linkedinLoginBtn');
  const usernameBtn = document.getElementById('usernameBtn');
  
  const dropdownUsernameBtn = document.getElementById('dropdownUsernameBtn');
  const dropdownAccountsBtn = document.getElementById('dropdownAccountsBtn');
  
  const navbarUsername = document.getElementById('navbarUsername');
  const currentAccountUsername = document.getElementById('currentAccountUsername');
  const loginStatusModal = new bootstrap.Modal(document.getElementById('linkedinLoginStatusModal'));
  const loginStatus = document.getElementById('loginStatus');
  const dashboardContent = document.getElementById('dashboard-content');
  const loginPrompt = document.getElementById('login-prompt');
  const usernameSetup = document.getElementById('username-setup');
  const loginPromptBtn = document.getElementById('loginPromptBtn');
  const saveUsernameBtn = document.getElementById('saveUsernameBtn');
  const saveModalUsernameBtn = document.getElementById('saveModalUsernameBtn');
  const usernameDisplay = document.getElementById('username-display');
  const userFilterModal = new bootstrap.Modal(document.getElementById('userFilterModal'));

  let currentStatusFilter = 'all';       
  let currentUserFilterType = 'all'; 
  let comments = [];
  let isLoggedIn = false; 
  let hasUsername = false; 
  const API_BASE_URL = '/api';
  
  const AUTH_STORAGE_KEY = 'linkedin_auth_status';
  const USERNAME_STORAGE_KEY = 'linkedin_username';
  const USER_FILTERS_STORAGE_KEY = 'user_filters';

  // Updated API client with analysis endpoint
  const api = {
    async fetchComments() {
      const username = stateManager.getUsername();
      console.log('Username from state:', username);
      
      if (!username) {
        throw new Error('Username not set');
      }
      
      try {
        const url = `${API_BASE_URL}/comments/link?username=${encodeURIComponent(username)}`;
        console.log('Fetching from URL:', url);
        
        const response = await fetch(url);
        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);
        
        if (!response.ok) {
          const errorData = await response.text();
          console.error('Server error response:', errorData);
          throw new Error(`HTTP ${response.status}: ${errorData}`);
        }
        
        const data = await response.json();
        console.log('Successfully loaded comments:', data.length, 'comments');
        return data;
        
      } catch (error) {
        console.error('Detailed fetch error:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        throw error;
      }
    },
    
    async getCommentById(id) {
      const response = await fetch(`${API_BASE_URL}/comments/${id}`);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return await response.json();
    },
    
    async approveComment(id) {
      try {
        const comment = await this.getCommentById(id);
        const username = comment.username;

        const response = await fetch(`${API_BASE_URL}/comments/${id}/approve`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ userId: id })
        });

        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        return await response.json();
      } catch (error) {
        console.error('Error approving comment:', error);
        throw error;
      }
    },
    
    async rejectComment(id) {
      const response = await fetch(`${API_BASE_URL}/comments/${id}/reject`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return await response.json();
    },
    
    async postComment(id) {
      const response = await fetch(`${API_BASE_URL}/comments/${id}/comment`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return await response.json();
    },
    
    async updateComment(id, comment) {
      const response = await fetch(`${API_BASE_URL}/comments/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comment }),
      });
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return await response.json();
    },
    
    async triggerFifo(username) {
      const response = await fetch(`${API_BASE_URL}/linkedin/trigger-fifo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP error ${response.status}: ${errorData.message || ''}`);
      }
      
      return await response.json();
    },
    
    async triggerAnalysis(username) {
      try {
        const response = await fetch(`${API_BASE_URL}/analysis/analyze-comments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username })
        });
        
        const data = await response.json();
        console.log('Analysis started:', data);
        return data;
      } catch (error) {
        console.error('Error:', error);
        throw error;
      }
    },
    
    async generateComment(postId, caption) {
      const response = await fetch(`${API_BASE_URL}/comments/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ postId, caption }),
      });
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return await response.json();
    },
    
    async linkedinLogin(username) {
      const response = await fetch(`${API_BASE_URL}/linkedin/login`, { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
      });
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return await response.json();
    },
    
    async checkLoginStatus() {
      const response = await fetch(`${API_BASE_URL}/instagram/status`);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return await response.json();
    },
    
    async setUsername(username) {
      console.log('Setting username:', username);
      const response = await fetch(`${API_BASE_URL}/linkedin/username`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
      });
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return await response.json();
    },
    
    async runLinkedInAgent(username) {
      const response = await fetch(`${API_BASE_URL}/linkedin/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
      });
      
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return await response.json();
    },
    
    async saveFilteredUser(filterUsername) {
      try {
        const username = stateManager.getUsername();
        console.log('Current username:', username);

        if (!username) {
          throw new Error('You must set your linkedin username first');
        }

        const targetUsername = filterUsername.trim().replace(/^@/, '').toLowerCase();
        console.log('Target username:', targetUsername);

        if (!targetUsername) {
          throw new Error('Target username is required');
        }

        const res = await fetch(`${API_BASE_URL}/linkedin/filtered-users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            username: stateManager.getUsername(),
            targetUsername: filterUsername 
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          console.error('Error response:', data);
          throw new Error(data.message || `HTTP ${res.status}`);
        }

        return data;
      } catch (error) {
        console.error('Error in saveFilteredUser:', error);
        throw error;
      }
    },
    
    async getFilteredUsers() {
      const username = stateManager.getUsername();
      
      if (!username) {
        throw new Error('Username is required');
      }
      
      try {
        const response = await fetch(`${API_BASE_URL}/linkedin/filtered-users?username=${encodeURIComponent(username)}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${response.status}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('API error in getFilteredUsers:', error);
        throw error;
      }
    },
    
    async deleteFilteredUser(targetUsername) {
      try {
        const username = stateManager.getUsername();
        
        if (!username) {
          throw new Error('Username not found in localStorage');
        }
        
        const res = await fetch(`${API_BASE_URL}/linkedin/filtered-users/${targetUsername}?username=${encodeURIComponent(username)}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ message: `HTTP Error ${res.status}` }));
          throw new Error(errorData.message || `HTTP Error ${res.status}`);
        }
        
        return await res.json();
      } catch (error) {
        console.error('Error in deleteFilteredUser:', error);
        throw error;
      }
    },

    async updateUserFilters(usernames) {
      const response = await fetch(`${API_BASE_URL}/filters/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ usernames }),
      });

      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return await response.json();
    }
  };

  const FILTER_STORAGE_KEY = 'default_filter';
  const ACCOUNTS_STORAGE_KEY = 'instagram_accounts';
  
  const stateManager = {
    KEYS: {
      USER_FILTERS: USER_FILTERS_STORAGE_KEY
    },

    getUserFilters() {
      try {
        const data = localStorage.getItem(this.KEYS.USER_FILTERS);
        if (!data) return [];

        const parsed = JSON.parse(data);

        if (Array.isArray(parsed)) {
          if (parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0].username) {
            return parsed.map(item => item.username);
          }
          return parsed;
        }

        return [];
      } catch (error) {
        console.error('Error parsing user filters:', error);
        return [];
      }
    },

    saveUserFilters(filters) {
      localStorage.setItem(this.KEYS.USER_FILTERS, JSON.stringify(filters));
    },

    saveLoginState(username) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        loggedIn: true,
        username: username || 'user',
        timestamp: new Date().toISOString()
      }));
    },
    
    getLoginState() {
      try {
        const state = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY));
        return state || { loggedIn: false };
      } catch (error) {
        console.error('Error parsing auth state:', error);
        return { loggedIn: false };
      }
    },
    
    clearLoginState() {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    },
    
    saveUsername(username) {
      localStorage.setItem(USERNAME_STORAGE_KEY, username);
      if (usernameDisplay) {
        usernameDisplay.textContent = username ? `(@${username})` : '';
      }
      if (navbarUsername) {
        navbarUsername.textContent = username || 'Account';
      }
      if (currentAccountUsername) {
        currentAccountUsername.textContent = username || '';
      }
      
      this.addAccount(username);
    },
    
    getUsername() {
      return localStorage.getItem(USERNAME_STORAGE_KEY) || '';
    },
    
    clearUsername() {
      localStorage.removeItem(USERNAME_STORAGE_KEY);
    },
    
    async fetchFilteredUsers() {
      try {
        const filteredUsers = await api.getFilteredUsers();
        return filteredUsers;
      } catch (error) {
        console.error('Error fetching filtered users:', error);
        return [];
      }
    },

    async addUserFilter(username) {
      if (!username) return;
      
      try {
        const newUser = await api.saveFilteredUser(username);
        
        const normalizedUsername = username.trim().replace(/^@/, '').toLowerCase();
        
        let filters = this.getUserFilters();
        
        const normalizedFilters = filters.map(f => 
          typeof f === 'object' ? f.username.toLowerCase() : f.toLowerCase()
        );
        
        if (!normalizedFilters.includes(normalizedUsername)) {
          filters.push(normalizedUsername);
          this.saveUserFilters(filters);
        }
        
        return newUser;
      } catch (error) {
        console.error('Error adding user filter:', error);
        throw error;
      }
    },

    async removeUserFilter(targetUsername) {
      try {
        await api.deleteFilteredUser(targetUsername);

        const filters = this.getUserFilters();
        const updatedFilters = filters.filter(filter => filter !== targetUsername);
        this.saveUserFilters(updatedFilters);
      } catch (error) {
        console.error('Error removing user filter:', error);
        throw error;
      }
    },
    
    getAccounts() {
      try {
        const accounts = JSON.parse(localStorage.getItem(ACCOUNTS_STORAGE_KEY));
        return accounts || [];
      } catch (error) {
        console.error('Error parsing accounts:', error);
        return [];
      }
    },
    
    addAccount(username) {
      if (!username) return;
      
      const accounts = this.getAccounts();
      if (!accounts.includes(username)) {
        accounts.push(username);
        localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
      }
    },
    
    removeAccount(username) {
      const accounts = this.getAccounts();
      const updatedAccounts = accounts.filter(account => account !== username);
      localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(updatedAccounts));
      
      if (this.getUsername() === username) {
        this.clearUsername();
      }
    },
    
    getDefaultFilter() {
      return localStorage.getItem(this.KEYS.DEFAULT_FILTER) || 'all';
    },
  };

  // Analysis Modal Functions
  function showCommentAnalysis(comment) {
    console.log('Opening analysis modal for comment:', comment);
    
    // Check if comment has "posted" status
    const isPosted = comment.status === 'posted';
    
    // Update modal elements
    document.getElementById('analysisPostId').textContent = comment.postUrl || comment.postId || 'N/A';
    document.getElementById('analysisCommentStatus').textContent = comment.status || 'Unknown';
    document.getElementById('analysisCommentStatus').className = `badge ${getStatusBadgeClass(comment.status)}`;
    document.getElementById('analysisCommentText').textContent = comment.comment || 'No comment text';
    
    // Format dates
    const postedDate = comment.timestamp ? new Date(comment.timestamp).toLocaleString() : 'N/A';
    const analyzedDate = comment.lastUpdated ? new Date(comment.lastUpdated).toLocaleString() : 
                         comment.analyzedAt ? new Date(comment.analyzedAt).toLocaleString() : 'Never';
    
    document.getElementById('analysisPostedDate').textContent = postedDate;
    document.getElementById('analysisLastAnalyzed').textContent = analyzedDate;
    
    if (isPosted) {
      // Show engagement statistics
      document.getElementById('analysisLikes').textContent = comment.likes || 0;
      document.getElementById('analysisImpressions').textContent = comment.impressions || 0;
      document.getElementById('analysisReplies').textContent = comment.repliesCount || 0;
      
      // Update status badge
      const statusBadge = document.getElementById('analysisStatusBadge');
      const statusText = document.getElementById('analysisStatusText');
      
      if (comment.lastError) {
        statusBadge.className = 'badge bg-warning';
        statusBadge.textContent = 'Analysis Error';
        statusText.textContent = comment.lastError;
      } else if (comment.lastUpdated) {
        statusBadge.className = 'badge bg-success';
        statusBadge.textContent = 'Analyzed';
        statusText.textContent = `Last updated: ${analyzedDate}`;
      } else {
        statusBadge.className = 'badge bg-info';
        statusBadge.textContent = 'Pending Analysis';
        statusText.textContent = 'Waiting for first analysis';
      }
      
      // Show/hide replies
      const repliesList = document.getElementById('repliesList');
      const repliesCount = document.getElementById('repliesCount');
      const noRepliesMessage = document.getElementById('noRepliesMessage');
      
      repliesCount.textContent = comment.repliesCount || 0;
      
      if (comment.repliesData && comment.repliesData.length > 0) {
        noRepliesMessage.style.display = 'none';
        repliesList.innerHTML = '';
        
        comment.repliesData.forEach((reply, index) => {
          const replyElement = document.createElement('div');
          replyElement.className = 'card mb-2';
          replyElement.innerHTML = `
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <h6 class="mb-0"><i class="bi bi-person-circle"></i> ${reply.username || 'Unknown'}</h6>
                <small class="text-muted">${reply.timestamp || 'N/A'}</small>
              </div>
              <p class="mb-2">${reply.text || ''}</p>
              <div class="d-flex gap-3">
                <small class="text-muted">
                  <i class="bi bi-heart-fill text-danger"></i> ${reply.likes || 0} likes
                </small>
                ${reply.impressions ? `
                  <small class="text-muted">
                    <i class="bi bi-eye-fill text-primary"></i> ${reply.impressions} impressions
                  </small>
                ` : ''}
              </div>
            </div>
          `;
          repliesList.appendChild(replyElement);
        });
      } else {
        noRepliesMessage.style.display = 'block';
        repliesList.innerHTML = '';
        repliesList.appendChild(noRepliesMessage);
      }
      
      // Show/hide appropriate sections
      document.getElementById('analysisError').style.display = comment.lastError ? 'block' : 'none';
      if (comment.lastError) {
        document.getElementById('analysisErrorMessage').textContent = comment.lastError;
      }
      document.getElementById('nonPostedNotice').style.display = 'none';
      
    } else {
      // Comment is not posted - show notice
      document.getElementById('nonPostedNotice').style.display = 'block';
      document.getElementById('nonPostedCurrentStatus').textContent = comment.status || 'Unknown';
      document.getElementById('analysisError').style.display = 'none';
      
      // Hide engagement data
      document.getElementById('analysisLikes').textContent = '—';
      document.getElementById('analysisImpressions').textContent = '—';
      document.getElementById('analysisReplies').textContent = '—';
      document.getElementById('repliesCount').textContent = '0';
      document.getElementById('noRepliesMessage').style.display = 'block';
      document.getElementById('repliesList').innerHTML = '';
      document.getElementById('repliesList').appendChild(document.getElementById('noRepliesMessage'));
    }
    
    // Store comment ID for refresh functionality
    document.getElementById('refreshAnalysisBtn').dataset.commentId = comment.id;
    
    // Show the modal
    commentAnalysisModal.show();
  }

  // Refresh Analysis Button Handler
  document.getElementById('refreshAnalysisBtn')?.addEventListener('click', async function() {
    const commentId = this.dataset.commentId;
    if (!commentId) return;
    
    try {
      this.disabled = true;
      this.innerHTML = '<i class="bi bi-hourglass-split"></i> Refreshing...';
      
      // Reload comments to get fresh data
      await loadComments();
      
      // Find the updated comment
      const updatedComment = comments.find(c => c.id === commentId);
      if (updatedComment) {
        showCommentAnalysis(updatedComment);
      }
      
      this.disabled = false;
      this.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refresh Analysis';
    } catch (error) {
      console.error('Error refreshing analysis:', error);
      alert('Error refreshing analysis data');
      this.disabled = false;
      this.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refresh Analysis';
    }
  });

  // User Filter Management Functions
  async function populateUserFiltersList() {
    const list = document.getElementById('userFiltersList');
    const noUsersMessage = document.getElementById('noUsersMessage');

    if (!list) {
      console.error('User filters list element not found');
      return;
    }

    list.innerHTML = '';

    try {
      const username = stateManager.getUsername();
    
      if (!username) {
        list.innerHTML = `
          <div class="alert alert-warning">
            Username not found in localStorage
          </div>
        `;
        return;
      }
      
      const response = await api.getFilteredUsers();
      
      let targetUsernames = [];
      
      if (Array.isArray(response)) {
        targetUsernames = response;
      } else if (response && typeof response === 'object' && Array.isArray(response.targetUsernames)) {
        targetUsernames = response.targetUsernames;
      }
      
      if (!targetUsernames || targetUsernames.length === 0) {
        if (noUsersMessage) {
          noUsersMessage.style.display = 'block';
          list.appendChild(noUsersMessage.cloneNode(true));
        } else {
          const emptyMessage = document.createElement('div');
          emptyMessage.className = 'list-group-item text-center';
          emptyMessage.textContent = 'No filtered users found';
          list.appendChild(emptyMessage);
        }
        return;
      }
      
      if (noUsersMessage) {
        noUsersMessage.style.display = 'none';
      }
      
      targetUsernames.forEach(targetUsername => {
        const item = document.createElement('div');
        item.className = 'list-group-item d-flex justify-content-between align-items-center';
        item.innerHTML = `
          <span>@${targetUsername}</span>
          <button class="btn btn-sm btn-outline-danger remove-filter-btn" data-username="${targetUsername}">
            <i class="bi bi-trash"></i>
          </button>
        `;
        list.appendChild(item);
      });
      
      attachRemoveFilterListeners();
      
    } catch (error) {
      console.error('Error loading filtered users:', error);
      list.innerHTML = `
        <div class="alert alert-danger">
          Error loading filtered users: ${error.message}
        </div>
      `;
    }
  }

  function attachRemoveFilterListeners() {
    document.querySelectorAll('.remove-filter-btn').forEach(btn => {
      btn.addEventListener('click', async function(e) {
        e.preventDefault();
        const targetUsername = this.dataset.username;
        
        if (!confirm(`Remove @${targetUsername} from filter?`)) return;
        
        try {
          this.disabled = true;
          this.innerHTML = '<i class="bi bi-hourglass-split"></i>';
          
          const response = await api.deleteFilteredUser(targetUsername);
          
          if (response && response.success) {
            await stateManager.removeUserFilter(targetUsername);
            
            await populateUserFiltersList();
            renderComments();
            updateFilterBanner();
            
            dataSourceInfo.innerHTML = `
              <div class="alert alert-success">
                <i class="bi bi-check-circle"></i> Removed @${targetUsername} from filters
              </div>
            `;
            
            setTimeout(() => updateFilterBanner(), 3000);
          } else {
            throw new Error('Server returned unsuccessful status');
          }
          
        } catch (err) {
          console.error('Error removing filter:', err);
          
          this.disabled = false;
          this.innerHTML = '<i class="bi bi-trash"></i>';
          
          alert(`Could not remove filter: ${err.message || 'Unknown error'}`);
        }
      });
    });
  }

  document.getElementById('addUserFilterBtn').addEventListener('click', async () => {
    const input = document.getElementById('newUserFilter');
    const username = input.value.trim().replace(/^@/, '');
    
    if (!username) {
      alert('Please enter a valid username');
      return;
    }
    
    try {
      const addBtn = document.getElementById('addUserFilterBtn');
      addBtn.disabled = true;
      addBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Adding...';
      
      await api.saveFilteredUser(username);
      
      input.value = '';
      await populateUserFiltersList();
      
      currentUserFilterType = 'user';
      filterOptionDropdown.value = 'user';
      renderComments();
      updateFilterBanner();
      
      dataSourceInfo.innerHTML = `
        <div class="alert alert-success">
          <i class="bi bi-check-circle"></i> Added @${username} to filters
        </div>
      `;
      
      setTimeout(() => updateFilterBanner(), 3000);
      
    } catch (err) {
      alert(`Could not add filter: ${err.message}`);
    } finally {
      const addBtn = document.getElementById('addUserFilterBtn');
      addBtn.disabled = false;
      addBtn.innerHTML = 'Add User';
    }
  });

  document.querySelector('[data-filter="all"]')?.addEventListener('click', () => {
    currentUserFilterType = 'all';
    
    document.querySelector('[data-filter].active')?.classList.remove('active');
    document.querySelector('[data-filter="all"]')?.classList.add('active');
    
    if (typeof filterOptionDropdown !== 'undefined' && filterOptionDropdown) {
      filterOptionDropdown.value = 'all';
    }
    
    if (stateManager && typeof stateManager.setFilteredUsers === 'function') {
      stateManager.setFilteredUsers([]);
    } else {
      window.filteredUsers = [];
    }
    
    renderComments();
    if (typeof updateFilterBanner === 'function') {
      updateFilterBanner();
    }
  });

  document.getElementById('manageUsersBtn').addEventListener('click', () => {
    populateUserFiltersList();
    userFilterModal.show();
  });

  // Initial State Check
  async function checkInitialState() {
    try {
      dataSourceInfo.innerHTML = `
        <div class="alert alert-info">
          <i class="bi bi-hourglass-split"></i> Checking connection status...
        </div>
      `;

      const storedState = stateManager.getLoginState();
      const storedUsername = stateManager.getUsername();

      let serverResponse;
      try {
        serverResponse = await api.checkLoginStatus();
        
        isLoggedIn = serverResponse.loggedIn;
        
        if (isLoggedIn) {
          stateManager.saveLoginState(serverResponse.username);
          
          if (!storedUsername && serverResponse.username) {
            stateManager.saveUsername(serverResponse.username);
          }
        } else {
          stateManager.clearLoginState();
        }
      } catch (serverError) {
        console.error('Server check failed:', serverError);
        isLoggedIn = storedState.loggedIn;
        
        dataSourceInfo.innerHTML = `
          <div class="alert alert-warning">
            <i class="bi bi-exclamation-triangle"></i> Could not verify login status with server. Using stored credentials.
          </div>
        `;
      }

      hasUsername = !!stateManager.getUsername();
      if (hasUsername) {
        usernameDisplay.textContent = `(@${stateManager.getUsername()})`;
      }

      updateUIState();

      if (isLoggedIn && hasUsername) {
        loadComments();
      }
    } catch (error) {
      console.error('Error in initialization:', error);
      dataSourceInfo.innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-triangle"></i> Error checking connection status: ${error.message}
        </div>
      `;

      hasUsername = !!stateManager.getUsername();
      updateUIState();
    }
  }
  
  function updateUIState() {
    usernameSetup.style.display = 'none';
    loginPrompt.style.display = 'none';
    dashboardContent.style.display = 'none';
    
    const username = stateManager.getUsername();
    
    if (navbarUsername) {
      navbarUsername.textContent = username || 'Account';
    }
    if (currentAccountUsername) {
      currentAccountUsername.textContent = username || '';
    }
    
    usernameBtn.style.display = hasUsername ? 'inline-block' : 'none';
    linkedinLoginBtn.style.display = (hasUsername && !isLoggedIn) ? 'inline-block' : 'none';
    
    const defaultFilter = stateManager.getDefaultFilter();
    if (filterOptionDropdown) {
      filterOptionDropdown.value = defaultFilter;
    }
    
    if (!hasUsername) {
      usernameSetup.style.display = 'block';
      dataSourceInfo.innerHTML = `
        <div class="alert alert-info">
          <i class="bi bi-info-circle"></i> Please set your linkedin username to continue
        </div>
      `;
    } else if (!isLoggedIn) {
      loginPrompt.style.display = 'block';
      dataSourceInfo.innerHTML = `
        <div class="alert alert-warning">
          <i class="bi bi-exclamation-triangle"></i> Please connect your linkedin account to view comments
        </div>
      `;
    } else {
      dashboardContent.style.display = 'block';
      dataSourceInfo.innerHTML = `
        <div class="alert alert-success">
          <i class="bi bi-check-circle"></i> Connected to linkedin as @${username || 'user'}
        </div>
      `;
    }
  }

  dropdownLogoutBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to log out?')) {
      stateManager.clearLoginState();
      stateManager.clearUsername();
      localStorage.clear();

      window.location.replace('login.html');
    }
  });
  
  dropdownUsernameBtn.addEventListener('click', () => {
    document.getElementById('modallinkedinUsername').value = stateManager.getUsername();
    usernameModal.show();
  });
  
  dropdownAccountsBtn.addEventListener('click', () => {
    populateAccountsList();
    accountsModal.show();
  });
  
  filterOptionDropdown.addEventListener('change', async e => {
    const selection = e.target.value;
    currentUserFilterType = selection;

    if (selection === 'user') {
      try {
        const users = await api.getFilteredUsers();
        if (!users.length) {
          alert('No users in filter list. Please add some first.');
          filterOptionDropdown.value = 'all';
          currentUserFilterType = 'all';
        }
      } catch (err) {
        alert(`Error fetching filters: ${err.message}`);
        filterOptionDropdown.value = 'all';
        currentUserFilterType = 'all';
      }
    }

    renderComments();
    updateFilterBanner();
  });

  filterButtons.forEach(btn => {
    btn.addEventListener('click', e => {
      document.querySelector('[data-filter].active')?.classList.remove('active');
      btn.classList.add('active');

      currentStatusFilter = btn.dataset.filter;
      renderComments();
    });
  });
  
  function populateAccountsList() {
    const accountsList = document.getElementById('accountsList');
    const accounts = stateManager.getAccounts();
    const currentUsername = stateManager.getUsername();
    
    const firstItem = accountsList.firstElementChild;
    accountsList.innerHTML = '';
    accountsList.appendChild(firstItem);
    
    currentAccountUsername.textContent = currentUsername;
    
    accounts.forEach(account => {
      if (account !== currentUsername) {
        const item = document.createElement('div');
        item.className = 'list-group-item';
        item.innerHTML = `
          <div class="d-flex w-100 justify-content-between align-items-center">
            <h6 class="mb-1">@${account}</h6>
            <div>
              <button class="btn btn-sm btn-outline-primary switch-account-btn" data-username="${account}">
                Switch
              </button>
              <button class="btn btn-sm btn-outline-danger remove-account-btn" data-username="${account}">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        `;
        accountsList.appendChild(item);
      }
    });
    
    document.querySelectorAll('.switch-account-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const username = e.target.dataset.username;
        stateManager.saveUsername(username);
        accountsModal.hide();
        updateUIState();
      });
    });
    
    document.querySelectorAll('.remove-account-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const username = e.target.closest('button').dataset.username;
        if (confirm(`Are you sure you want to remove @${username}?`)) {
          stateManager.removeAccount(username);
          populateAccountsList();
        }
      });
    });
  }
  
  document.getElementById('addAccountBtn')?.addEventListener('click', () => {
    accountsModal.hide();
    usernameModal.show();
  });

  checkInitialState();
  
  const savedFilter = stateManager.getDefaultFilter();
  if (savedFilter && filterOptionDropdown) {
    filterOptionDropdown.value = savedFilter;
  }

  async function triggerFifo(username) {
    try {
      const response = await fetch(`${API_BASE_URL}/linkedin/trigger-fifo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP error ${response.status}: ${errorData.message || ''}`);
      }
      
      const result = await response.json();
      console.log('FIFO process triggered successfully:', result);
      showToast('success', 'Automated comment processing started');
      return result;
    } catch (error) {
      console.error('Error triggering FIFO process:', error);
      showToast('warning', 'Problem with automated comment processing');
      throw error;
    }
  }

  async function triggerAnalysis(username) {
    console.log('Calling triggerAnalysis for username:', username);
    
    try {
      const response = await fetch(`${API_BASE_URL}/analysis/analyze-comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP ${response.status}: ${errorData.message || 'Unknown error'}`);
      }
      
      const data = await response.json();
      console.log('Analysis started successfully:', data);
      return data;
    } catch (error) {
      console.error('Error in triggerAnalysis:', error);
      throw error;
    }
  }
  
  async function saveUsername(username) {
    if (!username || username.trim() === '') {
      alert('Please enter a valid username');
      return;
    }
    
    try {
      username = username.trim().replace(/^@/, '');
      
      await api.setUsername(username);
      
      stateManager.saveUsername(username);
      hasUsername = true;
      
      updateUIState();
      
      const usernameInput = document.getElementById('instagramUsername');
      const modalUsernameInput = document.getElementById('modalInstagramUsername');
      
      if (usernameInput) {
        usernameInput.value = '';
      }
      
      if (modalUsernameInput) {
        modalUsernameInput.value = '';
      }
      
      if (typeof usernameModal !== 'undefined' && usernameModal) {
        try {
          usernameModal.hide();
        } catch (e) {
          console.log('Modal was not open or not initialized');
        }
      }
  
      // Fire both agents simultaneously - no waiting
      triggerFifo(username)
        .then(() => {
          console.log('FIFO process initiated for username:', username);
          if (typeof showToast === 'function') {
            showToast('success', 'Automated comment processing started');
          }
        })
        .catch((fifoError) => {
          console.error('Error triggering FIFO process:', fifoError);
          if (typeof showToast === 'function') {
            showToast('warning', 'Problem with automated comment processing');
          }
        });
  
      triggerAnalysis(username)
        .then(() => {
          console.log('Analysis process initiated for username:', username);
          if (typeof showToast === 'function') {
            showToast('success', 'Comment analysis started');
          }
        })
        .catch((analysisError) => {
          console.error('Error triggering analysis process:', analysisError);
          if (typeof showToast === 'function') {
            showToast('warning', 'Problem with comment analysis');
          }
        });
      
    } catch (error) {
      console.error('Error saving username:', error);
      alert(`Error saving username: ${error.message}`);
    }
  }

  async function runLinkedInAgent(username) {
    const response = await fetch(`${API_BASE_URL}/linkedin/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username }),
    });
    
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return await response.json();
  }
  
  async function handleInstagramLogin() {
    const username = stateManager.getUsername();
    
    if (!username) {
      alert('Please set your linkedin username first');
      return;
    }
    
    loginStatus.innerHTML = `
      <div class="d-flex justify-content-center">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>
      <p class="text-center mt-2">Launching linkedin login browser for @${username}...</p>
    `;
    
    loginStatusModal.show();
    
    try {
      const loginResult = await api.linkedinLogin(username);
      
      loginStatus.innerHTML = `
        <div class="alert alert-success">
          <i class="bi bi-check-circle-fill"></i> Cookies stored successfully!
          <p>linkedin agent is now running in the background...</p>
        </div>
      `;
      
      stateManager.saveLoginState(username);
      
      setTimeout(() => {
        loginStatusModal.hide();
        isLoggedIn = true;
        updateUIState();
        loadComments();
      }, 2000);
      
      runLinkedInAgent(username).catch(agentError => {
        console.error('Error in background linkedin agent execution:', agentError);
      });
      
    } catch (error) {
      console.error('Error during linkedin login:', error);
      
      loginStatus.innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-triangle-fill"></i> Error during linkedin login: ${error.message}
          <button class="btn btn-sm btn-outline-danger mt-2" id="retryLoginBtn">Retry</button>
        </div>
      `;
      
      document.getElementById('retryLoginBtn')?.addEventListener('click', () => handleInstagramLogin());
    }
  }
  
  async function loadComments() {
    if (!isLoggedIn || !hasUsername) {
      return;
    }
    
    try {
      const response = await api.fetchComments();
      
      if (response && Array.isArray(response.comments)) {
        comments = response.comments;
      } else if (Array.isArray(response)) {
        comments = response;
      } else {
        comments = [];
        console.warn('Unexpected API response format:', response);
      }
      
      const message = response.message || `${comments.length} comments loaded`;
      dataSourceInfo.innerHTML = `
        <div class="alert alert-success">
          <i class="bi bi-check-circle"></i> Connected to linkedin as @${stateManager.getUsername() || 'user'} 
          <span class="badge bg-secondary">${comments.length} comments loaded</span>
          ${response.message ? `<br><small>${response.message}</small>` : ''}
        </div>
      `;
      
      updateStatistics();
      renderComments();
    } catch (error) {
      console.error('Error loading comments:', error);
      dataSourceInfo.innerHTML = `
        <div class="alert alert-danger">
          <strong>Error:</strong> Failed to load comments from API.
          <p>${error.message}</p>
          <button class="btn btn-sm btn-primary" id="retryBtn">Retry</button>
        </div>
      `;
      document.getElementById('retryBtn')?.addEventListener('click', loadComments);
    }
  }

  function updateStatistics() {
    const stats = {
      total: comments.length,
      pending: comments.filter(c => c.status === 'pending').length,
      approved: comments.filter(c => c.status === 'approved').length,
      processing: comments.filter(c => c.status === 'processing').length,
      posted: comments.filter(c => c.status === 'posted').length,
      rejected: comments.filter(c => c.status === 'rejected').length,
      error: comments.filter(c => c.status === 'error').length
    };
    
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-pending').textContent = stats.pending;
    document.getElementById('stat-approved').textContent = stats.approved;
    document.getElementById('stat-processing').textContent = stats.processing;
    document.getElementById('stat-posted').textContent = stats.posted;
    document.getElementById('stat-rejected').textContent = stats.rejected;
  }

  function renderComments() {
    commentsContainer.innerHTML = '';

    let filtered = [...comments];

    if (currentStatusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === currentStatusFilter);
    }

    if (currentUserFilterType === 'user') {
      const userFilters = stateManager.getUserFilters()
        .map(u => {
          const username = typeof u === 'object' ? u.username : u;
          return username.trim().replace(/^@/, '').toLowerCase();
        });
      
      if (userFilters.length > 0) {
        filtered = filtered.filter(c => {
          const commentUsername = (c.username || '').trim().replace(/^@/, '').toLowerCase();
          return userFilters.includes(commentUsername);
        });
      }
    }

    filtered.sort((a, b) => {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      return dateB - dateA;
    });

    if (filtered.length === 0) {
      commentsContainer.innerHTML = `
        <div class="alert alert-info">
          <i class="bi bi-info-circle"></i>
          No comments match your filters.
        </div>`;
      return;
    }

    filtered.forEach(comment => {
      const card = document.createElement('div');
      card.className = `card comment-card ${comment.status}`;
      card.dataset.id = comment.id;
      
      const date = new Date(comment.timestamp);
      const formattedDate = date.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      let badgeClass = 'bg-secondary';
      if (comment.status === 'pending') badgeClass = 'bg-warning';
      if (comment.status === 'approved') badgeClass = 'bg-success';
      if (comment.status === 'processing') badgeClass = 'bg-primary';
      if (comment.status === 'posted') badgeClass = 'bg-info';
      if (comment.status === 'rejected') badgeClass = 'bg-danger';
      if (comment.status === 'error') badgeClass = 'bg-warning text-dark';
      
      let actionButtons = '';
      if (comment.status === 'pending') {
        actionButtons = `
          <button class="btn btn-sm btn-success approve-btn" data-id="${comment.id}">
            <i class="bi bi-check-circle"></i> Approve
          </button>
          <button class="btn btn-sm btn-danger reject-btn" data-id="${comment.id}">
            <i class="bi bi-x-circle"></i> Reject
          </button>
        `;
      } else if (comment.status === 'approved') {
        actionButtons = `
          <button class="btn btn-sm btn-primary post-btn" data-id="${comment.id}">
            <i class="bi bi-send"></i> Post Comment
          </button>
          <button class="btn btn-sm btn-danger reject-btn" data-id="${comment.id}">
            <i class="bi bi-x-circle"></i> Reject
          </button>
        `;
      } else if (comment.status === 'error') {
        actionButtons = `
          <button class="btn btn-sm btn-primary post-btn" data-id="${comment.id}">
            <i class="bi bi-send"></i> Retry Post
          </button>
        `;
      } else if (comment.status === 'posted') {
        actionButtons = `
          <button class="btn btn-sm btn-info view-analysis-btn" data-id="${comment.id}">
            <i class="bi bi-graph-up"></i> View Analysis
          </button>
        `;
      }
      
      let statusHistory = '';
      if (comment.history && comment.history.length > 0) {
        statusHistory = `
          <div class="status-history">
            <small>
              <i class="bi bi-clock-history"></i> Status history:
              ${comment.history.map(h => `
                <span class="badge ${getStatusBadgeClass(h.status)}">${h.status}</span>
                <span>${new Date(h.timestamp).toLocaleString()}</span>
              `).join(' → ')}
            </small>
          </div>
        `;
      }
      
      const modelBadge = comment.model 
        ? `<span class="badge bg-secondary json-model-badge">${comment.model}</span>` 
        : '';
      
      // Add engagement preview for posted comments
      let engagementPreview = '';
      if (comment.status === 'posted') {
        engagementPreview = `
          <div class="engagement-preview mt-2">
            <small class="text-muted">
              <i class="bi bi-heart-fill text-danger"></i> ${comment.likes || 0} likes
              <i class="bi bi-eye-fill text-primary ms-2"></i> ${comment.impressions || 0} impressions
              <i class="bi bi-chat-fill text-success ms-2"></i> ${comment.repliesCount || 0} replies
            </small>
          </div>
        `;
      }
      
      card.innerHTML = `
        <div class="card-body">
          <div class="section-name">Post link</div>
          <div class="post-id">
            <a
              href="${comment.postUrl}"
              target="_blank"
              class="badge post-id-badge"
            >
              ${comment.postId}
            </a>
          </div>

          <div class="section-name">Post Username</div>
          <p class="post-caption">${comment.postUsername}</p>

          <div class="section-name">Post Caption</div>
          <p class="post-caption">${comment.postCaption}</p>

          <div class="section-name">Comment</div>
          <p class="card-text">${comment.comment}</p>
          <div class="timestamp">
            ${formattedDate} ${modelBadge}
          </div>
          ${engagementPreview}
          ${statusHistory}
          <hr>
          <div class="btn-toolbar">
            <button class="btn btn-sm btn-outline-secondary edit-btn me-2" data-id="${comment.id}">
              <i class="bi bi-pencil"></i> Edit
            </button>
            ${actionButtons}
          </div>
        </div>
      `;
      
      commentsContainer.appendChild(card);
    });
    
    // Add event listeners for all buttons including analysis button
    document.querySelectorAll('.view-analysis-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.closest('button').dataset.id;
        const comment = comments.find(c => c.id === id);
        if (comment) {
          showCommentAnalysis(comment);
        }
      });
    });

    document.querySelectorAll('.approve-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.closest('button').dataset.id;
        try {
          const button = e.target.closest('button');
          button.disabled = true;
          button.innerHTML = '<i class="bi bi-hourglass"></i> Approving...';
          
          await api.approveComment(id);
          loadComments();
        } catch (error) {
          alert(`Error approving comment: ${error.message}`);
          const button = e.target.closest('button');
          button.disabled = false;
          button.innerHTML = '<i class="bi bi-check-circle"></i> Approve';
        }
      });
    });
    
    document.querySelectorAll('.reject-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.closest('button').dataset.id;
        if (confirm('Are you sure you want to reject this comment?')) {
          try {
            await api.rejectComment(id);
            loadComments();
          } catch (error) {
            alert(`Error rejecting comment: ${error.message}`);
          }
        }
      });
    });
    
    document.querySelectorAll('.post-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.closest('button').dataset.id;
        try {
          const button = e.target.closest('button');
          button.disabled = true;
          button.innerHTML = '<i class="bi bi-hourglass"></i> Posting...';
          
          await api.postComment(id);
          loadComments();
        } catch (error) {
          alert(`Error posting comment: ${error.message}`);
          const button = e.target.closest('button');
          button.disabled = false;
          button.innerHTML = '<i class="bi bi-send"></i> Post Comment';
        }
      });
    });
    
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.closest('button').dataset.id;
        try {
          const comment = await api.getCommentById(id);
          
          editCommentIdInput.value = comment.id;
          commentTextArea.value = comment.comment;
          postCaptionArea.value = comment.postCaption;
          postIdInput.value = comment.postId;
          
          editModal.show();
        } catch (error) {
          alert(`Error loading comment details: ${error.message}`);
        }
      });
    });
  }
  
  function getStatusBadgeClass(status) {
    switch (status) {
      case 'pending': return 'bg-warning text-dark';
      case 'approved': return 'bg-success';
      case 'processing': return 'bg-primary';
      case 'posted': return 'bg-info';
      case 'rejected': return 'bg-danger';
      case 'error': return 'bg-warning text-dark';
      default: return 'bg-secondary';
    }
  }

  function updateFilterBanner() {
    if (currentUserFilterType === 'user') {
      api.getFilteredUsers().then(users => {
        let userList = [];
        
        if (Array.isArray(users)) {
          userList = users;
        } else if (users && typeof users === 'object' && Array.isArray(users.filteredUsers)) {
          userList = users.filteredUsers;
        } else if (users && typeof users === 'object' && Array.isArray(users.users)) {
          userList = users.users;
        }
        
        const usernameList = userList.map(u => 
          typeof u === 'object' ? `@${u.username}` : `@${u}`
        );
        
        dataSourceInfo.innerHTML = `
          <div class="alert alert-info">
            <i class="bi bi-filter"></i>
            <strong>Filtering by users:</strong> ${usernameList.join(', ')}
            <button class="btn btn-sm btn-outline-secondary float-end" id="clearUserFiltersBtn">
              Clear Filter
            </button>
          </div>`;
          
        document.getElementById('clearUserFiltersBtn')?.addEventListener('click', () => {
          currentUserFilterType = 'all';
          filterOptionDropdown.value = 'all';
          renderComments();
          updateFilterBanner();
        });
      });
    } else {
      const username = stateManager.getUsername();
      const loggedIn = stateManager.getLoginState().loggedIn;
      
      if (username && loggedIn) {
        dataSourceInfo.innerHTML = `
          <div class="alert alert-success">
            <i class="bi bi-check-circle"></i> Connected to linkedin as @${username}
            <span class="badge bg-secondary ms-2">${comments.length} comments</span>
          </div>`;
      } else if (username && !loggedIn) {
        dataSourceInfo.innerHTML = `
          <div class="alert alert-warning">
            <i class="bi bi-exclamation-triangle"></i> Please connect your linkedin account to view comments
          </div>`;
      } else {
        dataSourceInfo.innerHTML = `
          <div class="alert alert-info">
            <i class="bi bi-info-circle"></i> Please set your linkedin username to continue
          </div>`;
      }
    }
  }

  saveCommentBtn.addEventListener('click', async () => {
    const id = editCommentIdInput.value;
    const comment = commentTextArea.value;
    
    if (!comment.trim()) {
      alert('Comment text cannot be empty');
      return;
    }
    
    try {
      await api.updateComment(id, comment);
      editModal.hide();
      loadComments();
    } catch (error) {
      alert(`Error updating comment: ${error.message}`);
    }
  });
  
  generateCommentBtn.addEventListener('click', async () => {
    const postId = document.getElementById('newPostId').value;
    const caption = document.getElementById('newPostCaption').value;
    
    if (!postId.trim() || !caption.trim()) {
      alert('Post ID and caption are required');
      return;
    }
    
    try {
      generateCommentBtn.disabled = true;
      generateCommentBtn.innerHTML = '<i class="bi bi-hourglass"></i> Generating...';
      
      const result = await api.generateComment(postId, caption);
      newCommentModal.hide();
      
      document.getElementById('newPostId').value = '';
      document.getElementById('newPostCaption').value = '';
      
      generateCommentBtn.disabled = false;
      generateCommentBtn.innerHTML = 'Generate Comment';
      
      loadComments();
    } catch (error) {
      alert(`Error generating comment: ${error.message}`);
      generateCommentBtn.disabled = false;
      generateCommentBtn.innerHTML = 'Generate Comment';
    }
  });
  
  refreshBtn.addEventListener('click', async () => {
    try {
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Loading...';
      
      await loadComments();
    } catch (error) {
      console.error('Error refreshing comments:', error);
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refresh';
    }
  });
  
  addNewCommentBtn.addEventListener('click', () => {
    newCommentModal.show();
  });
  
  linkedinLoginBtn.addEventListener('click', handleInstagramLogin);
  
  loginPromptBtn.addEventListener('click', handleInstagramLogin);
  
  usernameBtn.addEventListener('click', () => {
    document.getElementById('modallinkedinUsername').value = stateManager.getUsername();
    usernameModal.show();
  });
  
  saveUsernameBtn.addEventListener('click', () => {
    const username = document.getElementById('linkedinUsername').value;
    saveUsername(username);
  });
  
  saveModalUsernameBtn.addEventListener('click', () => {
    const username = document.getElementById('modallinkedinUsername').value;
    saveUsername(username);
  });

  checkInitialState();
});