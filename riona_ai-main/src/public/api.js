document.addEventListener('DOMContentLoaded', function () {
  const commentsContainer = document.getElementById('comments-container');
  const filterButtons = document.querySelectorAll('[data-filter]');
  const editModal = new bootstrap.Modal(document.getElementById('editCommentModal'));
  const newCommentModal = new bootstrap.Modal(document.getElementById('newCommentModal'));
  const usernameModal = new bootstrap.Modal(document.getElementById('usernameModal'));
  const accountsModal = new bootstrap.Modal(document.getElementById('accountsManagementModal'));
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
  const instagramLoginBtn = document.getElementById('instagramLoginBtn');
  const usernameBtn = document.getElementById('usernameBtn');
  const dropdownUsernameBtn = document.getElementById('dropdownUsernameBtn');
  const dropdownAccountsBtn = document.getElementById('dropdownAccountsBtn');
  const navbarUsername = document.getElementById('navbarUsername');
  const currentAccountUsername = document.getElementById('currentAccountUsername');
  const loginStatusModal = new bootstrap.Modal(document.getElementById('instagramLoginStatusModal'));
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
  let isLoggedIn = false; // Track Instagram login status
  let hasUsername = false; // Track if Instagram username is set
  const API_BASE_URL = '/api'; // Adjust based on your API configuration
  

  const AUTH_STORAGE_KEY = 'instagram_auth_status';
  const USERNAME_STORAGE_KEY = 'instagram_username';
  const USER_FILTERS_STORAGE_KEY = 'user_filters';
  // Updated API client
  const api = {
    async fetchComments() {
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
try {
// First, get the comment to find its username
const comment = await this.getCommentById(id);
const username = comment.username;

// Now make the approve request with the username
const response = await fetch(`${API_BASE_URL}/comments/${id}/approve`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ userId: id }) // Using comment ID as userId as per your backend expectation
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
      const response = await fetch(`${API_BASE_URL}/comments/trigger-fifo`, {
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
    async triggerAnalysis  (username)  {
      try {
        const response = await fetch(`${API_BASE_URL}/analysis/analyze-posted-comments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username, port })
        });
        
        const data = await response.json();
        console.log('Analysis started:', data);
      } catch (error) {
        console.error('Error:', error);
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
    async instagramLogin(username) {
      const response = await fetch(`${API_BASE_URL}/instagram/login`, { 
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
      // This would be a new API endpoint to set the username on the server
      console.log('Setting username:', username);
      const response = await fetch(`${API_BASE_URL}/instagram/username`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
      });
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return await response.json();
    },
    async runInstagramAgent  (username)  {
      const response = await fetch(`${API_BASE_URL}/instagram/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
      });
      
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return await response.json();
    },
    // API endpoints for user filtering
    async saveFilteredUser(filterUsername) {
try {
// Get username through the stateManager - for validation only
const username = stateManager.getUsername();
console.log('Current username:', username);

// Check if the user has set their Instagram username
if (!username) {
  throw new Error('You must set your Instagram username first');
}

// Process the filter username
const targetUsername = filterUsername.trim().replace(/^@/, '').toLowerCase();
console.log('Target username:', targetUsername);

// Check if target username is provided
if (!targetUsername) {
  throw new Error('Target username is required');
}

// Make the API request
const res = await fetch(`${API_BASE_URL}/instagram/filtered-users`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // Include cookies for authentication
  body: JSON.stringify({
username: stateManager.getUsername(), // From localStorage
targetUsername: filterUsername 
 }), });

// Get the response data
const data = await res.json();

// Check if request was successful
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
  // Get the username from stateManager instead of directly referencing an undefined variable
  const username = stateManager.getUsername();
  
  if (!username) {
    throw new Error('Username is required');
  }
  
  try {
    // Update the endpoint URL to match your backend structure
    // Looks like your API is using /api/instagram/filtered-users rather than /api/filtered-users
    const response = await fetch(`${API_BASE_URL}/instagram/filtered-users?username=${encodeURIComponent(username)}`);
    
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
    // Get username from localStorage
    const username = stateManager.getUsername();
    
    if (!username) {
      throw new Error('Username not found in localStorage');
    }
    
    const res = await fetch(`${API_BASE_URL}/instagram/filtered-users/${targetUsername}?username=${encodeURIComponent(username)}`, {
      method: 'DELETE',
      credentials: 'include' // Include cookies for authentication
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ message: `HTTP Error ${res.status}` }));
      throw new Error(errorData.message || `HTTP Error ${res.status}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error('Error in deleteFilteredUser:', error);
    throw error; // Re-throw so the caller can handle the error
  }
},

// Related but less core endpoint
async updateUserFilters  (usernames) {
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
}     
  // Helper functions for auth and username state management
  // Helper functions for auth and username state management
  const FILTER_STORAGE_KEY = 'default_filter';
  const ACCOUNTS_STORAGE_KEY = 'instagram_accounts';
  
  const stateManager = {
    KEYS: {
USER_FILTERS: USER_FILTERS_STORAGE_KEY
},

getUserFilters () {
try {
const data = localStorage.getItem(this.KEYS.USER_FILTERS);
if (!data) return [];

const parsed = JSON.parse(data);

// Handle both array of strings and array of objects
if (Array.isArray(parsed)) {
  // If it's array of objects with username property
  if (parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0].username) {
    return parsed.map(item => item.username);
  }
  // If it's array of strings
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
      // Also update display wherever needed
      if (usernameDisplay) {
        usernameDisplay.textContent = username ? `(@${username})` : '';
      }
      if (navbarUsername) {
        navbarUsername.textContent = username || 'Account';
      }
      if (currentAccountUsername) {
        currentAccountUsername.textContent = username || '';
      }
      
      // Save to accounts list if not already there
      this.addAccount(username);
      
      // Trigger the FIFO process and handle any errors
     
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
  // Synchronize with local storage
  
  return filteredUsers;
} catch (error) {
  console.error('Error fetching filtered users:', error);
  return [];
}
},

// Add a filtered user
async addUserFilter(username) {
  if (!username) return;
  
  try {
    // Save to server first
    const newUser = await api.saveFilteredUser(username);
    
    // Update local storage - normalize the username first
    const normalizedUsername = username.trim().replace(/^@/, '').toLowerCase();
    
    // Get current filters
    let filters = this.getUserFilters();
    
    // Check if username already exists (case insensitive)
    const normalizedFilters = filters.map(f => 
      typeof f === 'object' ? f.username.toLowerCase() : f.toLowerCase()
    );
    
    if (!normalizedFilters.includes(normalizedUsername)) {
      // Add new username to filters
      filters.push(normalizedUsername);
      this.saveUserFilters(filters);
    }
    
    return newUser;
  } catch (error) {
    console.error('Error adding user filter:', error);
    throw error;
  }
},

// Remove a filtered user
async removeUserFilter(targetUsername) {
  try {
    // Pas besoin de chercher l'ID puisque nous supprimons directement par targetUsername
    // Appeler directement l'API avec le targetUsername
    await api.deleteFilteredUser(targetUsername);

    // Mettre à jour le stockage local
    const filters = this.getUserFilters();
    const updatedFilters = filters.filter(filter => filter !== targetUsername);
    this.saveUserFilters(updatedFilters);
  } catch (error) {
    console.error('Error removing user filter:', error);
    throw error;
  }
},
    // Accounts management
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
      
      // If current username is removed, clear it
      if (this.getUsername() === username) {
        this.clearUsername();
      }
    },
    // Get default filter
    getDefaultFilter() {
      return localStorage.getItem(this.KEYS.DEFAULT_FILTER) || 'all';
    },


  
};

async function populateUserFiltersList() {
  const list = document.getElementById('userFiltersList');
  const noUsersMessage = document.getElementById('noUsersMessage');

  if (!list) {
    console.error('User filters list element not found');
    return;
  }

  // Clear existing list items
  list.innerHTML = '';

  try {
    // Get username from stateManager
    const username = stateManager.getUsername();
  
    if (!username) {
      list.innerHTML = `
        <div class="alert alert-warning">
          Username not found in localStorage
        </div>
      `;
      return;
    }
    
    // Fetch target usernames from server with username parameter
    const response = await api.getFilteredUsers();
    
    // Extract targetUsernames array from response
    let targetUsernames = [];
    
    if (Array.isArray(response)) {
      targetUsernames = response;
    } else if (response && typeof response === 'object' && Array.isArray(response.targetUsernames)) {
      targetUsernames = response.targetUsernames;
    }
    
    // Show "no users" message if empty
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
    
    // Hide the "no users" message if we have users
    if (noUsersMessage) {
      noUsersMessage.style.display = 'none';
    }
    
    // Render target usernames
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
    
    // Add event listeners to remove buttons
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
      e.preventDefault(); // Empêche le comportement par défaut du bouton
      const targetUsername = this.dataset.username;
      
      if (!confirm(`Remove @${targetUsername} from filter?`)) return;
      
      try {
        // Visual feedback - disable button and show loading state
        this.disabled = true;
        this.innerHTML = '<i class="bi bi-hourglass-split"></i>';
        
        // Delete from server using the targetUsername
        const response = await api.deleteFilteredUser(targetUsername);
        
        if (response && response.success) {
          // Update local storage
          await stateManager.removeUserFilter(targetUsername);
          
          // Refresh the list and update UI
          await populateUserFiltersList();
          renderComments();
          updateFilterBanner();
          
          // Show success message
          dataSourceInfo.innerHTML = `
            <div class="alert alert-success">
              <i class="bi bi-check-circle"></i> Removed @${targetUsername} from filters
            </div>
          `;
          
          // Restore normal display after 3 seconds
          setTimeout(() => updateFilterBanner(), 3000);
        } else {
          throw new Error('Server returned unsuccessful status');
        }
        
      } catch (err) {
        console.error('Error removing filter:', err);
        
        // Re-enable button on error
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
    // Disable button and show loading state
    const addBtn = document.getElementById('addUserFilterBtn');
    addBtn.disabled = true;
    addBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Adding...';
    
    // Add to server first
    await api.saveFilteredUser(username);

   
    
    // Clear input and refresh list
    input.value = '';
    await populateUserFiltersList();
    
    // Update UI to show we're filtering by users
    currentUserFilterType = 'user';
    filterOptionDropdown.value = 'user';
    renderComments();
    updateFilterBanner();
    
    // Show success message
    dataSourceInfo.innerHTML = `
      <div class="alert alert-success">
        <i class="bi bi-check-circle"></i> Added @${username} to filters
      </div>
    `;
    
    // Restore normal display after 3 seconds
    setTimeout(() => updateFilterBanner(), 3000);
    
  } catch (err) {
    alert(`Could not add filter: ${err.message}`);
  } finally {
    // Re-enable button in any case
    const addBtn = document.getElementById('addUserFilterBtn');
    addBtn.disabled = false;
    addBtn.innerHTML = 'Add User';
  }
});
// Update the Apply User Filters button handler


// Add automatic filter application for "all users"
document.querySelector('[data-filter="all"]')?.addEventListener('click', () => {
  // Set filter type to 'all'
  currentUserFilterType = 'all';
  
  // Update UI
  document.querySelector('[data-filter].active')?.classList.remove('active');
  document.querySelector('[data-filter="all"]')?.classList.add('active');
  
  if (typeof filterOptionDropdown !== 'undefined' && filterOptionDropdown) {
    filterOptionDropdown.value = 'all';
  }
  
  // Clear filtered users
  if (stateManager && typeof stateManager.setFilteredUsers === 'function') {
    stateManager.setFilteredUsers([]);
  } else {
    window.filteredUsers = [];
  }
  
  // Update the UI
  renderComments();
  if (typeof updateFilterBanner === 'function') {
    updateFilterBanner();
  }
});

// “Manage Users” opens the modal
document.getElementById('manageUsersBtn').addEventListener('click', () => {
populateUserFiltersList();
userFilterModal.show();
});

// Add User Filter button handler



// Update the API to include a new userFilters method
api.updateUserFilters = async (usernames) => {
const response = await fetch(`${API_BASE_URL}/filters/users`, {
method: 'POST',
headers: {
  'Content-Type': 'application/json',
},
body: JSON.stringify({ usernames }),
});

if (!response.ok) throw new Error(`HTTP error ${response.status}`);
return await response.json();
};
  
  // Check initial state - first check localStorage, then verify with server
  async function checkInitialState() {
try {
// Show loading state
dataSourceInfo.innerHTML = `
  <div class="alert alert-info">
    <i class="bi bi-hourglass-split"></i> Checking connection status...
  </div>
`;

// Get stored state for fallback
const storedState = stateManager.getLoginState();
const storedUsername = stateManager.getUsername();

// First check with server
let serverResponse;
try {
  serverResponse = await api.checkLoginStatus();
  
  // Update based on server response (as source of truth)
  isLoggedIn = serverResponse.loggedIn;
  
  if (isLoggedIn) {
    // If server says we're logged in, update stored state
    stateManager.saveLoginState(serverResponse.username);
    
    // If no username stored but server has it, use that
    if (!storedUsername && serverResponse.username) {
      stateManager.saveUsername(serverResponse.username);
    }
  } else {
    // Server says not logged in, clear stored state
    stateManager.clearLoginState();
  }
} catch (serverError) {
  console.error('Server check failed:', serverError);
  // If server check fails, fallback to stored state
  isLoggedIn = storedState.loggedIn;
  
  // Show warning about using cached credentials
  dataSourceInfo.innerHTML = `
    <div class="alert alert-warning">
      <i class="bi bi-exclamation-triangle"></i> Could not verify login status with server. Using stored credentials.
    </div>
  `;
}

// Update username status
hasUsername = !!stateManager.getUsername();
if (hasUsername) {
  usernameDisplay.textContent = `(@${stateManager.getUsername()})`;
}

// Update UI based on final state
updateUIState();

// If we're good to go, load comments
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

// Still update UI with what we know
hasUsername = !!stateManager.getUsername();
updateUIState();
}
}
  
  // Helper function to determine and update UI state based on username and login status
  // Helper function to determine and update UI state based on username and login status
  function updateUIState() {
    // First, hide all content sections
    usernameSetup.style.display = 'none';
    loginPrompt.style.display = 'none';
    dashboardContent.style.display = 'none';
    
    // Get current username
    const username = stateManager.getUsername();
    
    // Update username displays
    if (navbarUsername) {
      navbarUsername.textContent = username || 'Account';
    }
    if (currentAccountUsername) {
      currentAccountUsername.textContent = username || '';
    }
    
    // Show/hide appropriate navbar buttons
    usernameBtn.style.display = hasUsername ? 'inline-block' : 'none';
    instagramLoginBtn.style.display = (hasUsername && !isLoggedIn) ? 'inline-block' : 'none';
    
    // Set default filter if available
    const defaultFilter = stateManager.getDefaultFilter();
    if (filterOptionDropdown) {
      filterOptionDropdown.value = defaultFilter;
    }
    
    // Then show appropriate section based on state
    if (!hasUsername) {
      // Step 1: Need to set username
      usernameSetup.style.display = 'block';
      dataSourceInfo.innerHTML = `
        <div class="alert alert-info">
          <i class="bi bi-info-circle"></i> Please set your Instagram username to continue
        </div>
      `;
    } else if (!isLoggedIn) {
      // Step 2: Have username but need to connect Instagram
      loginPrompt.style.display = 'block';
      dataSourceInfo.innerHTML = `
        <div class="alert alert-warning">
          <i class="bi bi-exclamation-triangle"></i> Please connect your Instagram account to view comments
        </div>
      `;
    } else {
      // Step 3: Have username and connected to Instagram
      dashboardContent.style.display = 'block';
      dataSourceInfo.innerHTML = `
        <div class="alert alert-success">
          <i class="bi bi-check-circle"></i> Connected to Instagram as @${username || 'user'}
        </div>
      `;
    }
  }
  // Dropdown logout button handler
  // Dropdown logout button handler
dropdownLogoutBtn.addEventListener('click', () => {
if (confirm('Are you sure you want to log out?')) {
// Clear all storage items
stateManager.clearLoginState();
stateManager.clearUsername();
localStorage.clear(); // Clear all localStorage items

// Redirect to login.html and replace history state so back button doesn't return to dashboard
window.location.replace('login.html');
}
});
  
  // Dropdown username button handler
  dropdownUsernameBtn.addEventListener('click', () => {
    // Pre-fill with current username
    document.getElementById('modalInstagramUsername').value = stateManager.getUsername();
    usernameModal.show();
  });
  
  // Dropdown accounts button handler
  dropdownAccountsBtn.addEventListener('click', () => {
    // Populate accounts list
    populateAccountsList();
    accountsModal.show();
  });
  
  // Filter option dropdown handler
  filterOptionDropdown.addEventListener('change', async e => {
const selection = e.target.value;       // "all" or "user"
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
// update the active button UI
document.querySelector('[data-filter].active')?.classList.remove('active');
btn.classList.add('active');

currentStatusFilter = btn.dataset.filter;
renderComments();
});
});

  
  // Function to populate accounts list in the modal
  function populateAccountsList() {
    const accountsList = document.getElementById('accountsList');
    const accounts = stateManager.getAccounts();
    const currentUsername = stateManager.getUsername();
    
    // Clear current list except first item (current account)
    const firstItem = accountsList.firstElementChild;
    accountsList.innerHTML = '';
    accountsList.appendChild(firstItem);
    
    // Update current account display
    currentAccountUsername.textContent = currentUsername;
    
    // Add other accounts
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
    
    // Add event listeners to switch and remove buttons
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
          populateAccountsList(); // Refresh the list
        }
      });
    });
  }
  
  // Add account button handler
  document.getElementById('addAccountBtn')?.addEventListener('click', () => {
    accountsModal.hide();
    usernameModal.show();
  });

  // Initialize the application
  checkInitialState();
  
  // Set initial filter option
  const savedFilter = stateManager.getDefaultFilter();
  if (savedFilter && filterOptionDropdown) {
    filterOptionDropdown.value = savedFilter;
  }
  async function triggerFifo(username) {
    try {
      const response = await fetch(`${API_BASE_URL}/comments/trigger-fifo`, {
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
      const response = await fetch(`${API_BASE_URL}/analysis/analyze-posted-comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Enlever le paramètre port ou le rendre optionnel
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
  
  // Save Instagram username
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
     
      // Fire both processes in parallel WITHOUT waiting (fire-and-forget)
      console.log('Starting both FIFO and Analysis processes for username:', username);
      
      // FIFO process - runs independently
      triggerFifo(username)
        .then(() => {
          console.log('FIFO process initiated successfully for username:', username);
          if (typeof showToast === 'function') {
            showToast('success', 'Automated comment processing started');
          }
        })
        .catch((error) => {
          console.error('Error triggering FIFO process:', error);
          if (typeof showToast === 'function') {
            showToast('warning', 'Problem with automated comment processing');
          }
        });
      
      // Analysis process - runs independently
      triggerAnalysis(username)
        .then(() => {
          console.log('Analysis process initiated successfully for username:', username);
          if (typeof showToast === 'function') {
            showToast('success', 'Comment analysis started');
          }
        })
        .catch((error) => {
          console.error('Error triggering analysis process:', error);
          if (typeof showToast === 'function') {
            showToast('warning', 'Problem with comment analysis');
          }
        });
      
    } catch (error) {
      console.error('Error saving username:', error);
      alert(`Error saving username: ${error.message}`);
    }
  }
  async function runInstagramAgent(username) {
    const response = await fetch(`${API_BASE_URL}/instagram/run`, {
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
    alert('Please set your Instagram username first');
    return;
  }
  
  loginStatus.innerHTML = `
    <div class="d-flex justify-content-center">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>
    <p class="text-center mt-2">Launching Instagram login browser for @${username}...</p>
  `;
  
  loginStatusModal.show();
  
  try {
    // first handle the loging and cookies storage via the api 
    const loginResult = await api.instagramLogin(username);
    
    loginStatus.innerHTML = `
      <div class="alert alert-success">
        <i class="bi bi-check-circle-fill"></i> Cookies stored successfully!
        <p>Instagram agent is now running in the background...</p>
      </div>
    `;
    
    // Update both localstorage items 
    stateManager.saveLoginState(username);
    
    // Update UI and go to dashboard immediately
    setTimeout(() => {
      loginStatusModal.hide();
      isLoggedIn = true;
      updateUIState();
      loadComments();
    }, 2000);
    
    
    runInstagramAgent(username).catch(agentError => {
      console.error('Error in background Instagram agent execution:', agentError);
      // Optionally notify the user about agent errors via a toast notification
    });
   
    
  } catch (error) {
    console.error('Error during Instagram login:', error);
    
    loginStatus.innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-triangle-fill"></i> Error during Instagram login: ${error.message}
        <button class="btn btn-sm btn-outline-danger mt-2" id="retryLoginBtn">Retry</button>
      </div>
    `;
    
    document.getElementById('retryLoginBtn')?.addEventListener('click', () => handleInstagramLogin());
  }
}
  // Load comments from API
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
      
      // Calculate analysis statistics
      const analyzedComments = comments.filter(c => 
        c.status === 'posted' && (c.likes !== undefined || c.repliesCount !== undefined)
      ).length;
      const totalLikes = comments.reduce((sum, c) => sum + (c.likes || 0), 0);
      const totalReplies = comments.reduce((sum, c) => sum + (c.repliesCount || 0), 0);
      
      const message = response.message || `${comments.length} comments loaded`;
      dataSourceInfo.innerHTML = `
        <div class="alert alert-success">
          <i class="bi bi-check-circle"></i> Connected to Instagram as @${stateManager.getUsername() || 'user'} 
          <span class="badge bg-secondary">${comments.length} comments loaded</span>
          ${analyzedComments > 0 ? `
            <span class="badge bg-info">${analyzedComments} analyzed</span>
            <span class="badge bg-primary">${totalLikes} total likes</span>
            <span class="badge bg-primary">${totalReplies} total replies</span>
          ` : ''}
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
  // Helper function to format date
function formatDate(dateString) {
  if (!dateString) return 'Not available';
  const date = new Date(dateString);
  return date.toLocaleString();
}

// Function to fill analysis modal with comment data
function fillAnalysisModal(comment) {
  // Populate basic comment info
  document.getElementById('analysisPostId').textContent = comment.postId || 'N/A';
  document.getElementById('analysisCommentText').textContent = comment.comment || '';
  document.getElementById('analysisPostedDate').textContent = formatDate(comment.timestamp);
  document.getElementById('analysisCommentStatus').textContent = comment.status || 'unknown';
  document.getElementById('analysisCommentStatus').className = `badge bg-${getStatusColor(comment.status)}`;
  console.log('Comment data:', comment);
  console.log('Replies data:', comment.repliesData);
  console.log('Replies count:', comment.repliesCount);
  // Check if comment is posted and has analysis data
  const isPosted = comment.status === 'posted';
  const hasAnalysisData = comment.likes !== undefined || comment.repliesCount !== undefined;
  
  if (isPosted && hasAnalysisData) {
    // Show engagement statistics
    document.getElementById('analysisLikes').textContent = comment.likes || 0;
    document.getElementById('analysisReplies').textContent = comment.repliesCount || 0;
    document.getElementById('analysisTotalEngagement').textContent = (comment.likes || 0) + (comment.repliesCount || 0);
    document.getElementById('repliesCount').textContent = comment.repliesCount || 0;
    
    // Show last analyzed time
    document.getElementById('analysisLastAnalyzed').textContent = comment.lastUpdated 
      ? formatDate(comment.lastUpdated) 
      : 'Not yet analyzed';
    
    // Update analysis status
    if (comment.lastUpdated) {
      const hoursAgo = Math.floor((Date.now() - new Date(comment.lastUpdated).getTime()) / (1000 * 60 * 60));
      document.getElementById('analysisStatusBadge').className = 'badge bg-success me-2';
      document.getElementById('analysisStatusBadge').textContent = 'Analyzed';
      document.getElementById('analysisStatusText').textContent = `Updated ${hoursAgo}h ago`;
    } else {
      document.getElementById('analysisStatusBadge').className = 'badge bg-warning me-2';
      document.getElementById('analysisStatusBadge').textContent = 'Pending Analysis';
      document.getElementById('analysisStatusText').textContent = 'Waiting for first analysis';
    }
    
    // Populate replies
   
    const repliesList = document.getElementById('repliesList');
  const noRepliesMessage = document.getElementById('noRepliesMessage');
  
  console.log('repliesList element:', repliesList);
  console.log('noRepliesMessage element:', noRepliesMessage);
  
  if (comment.repliesData && Array.isArray(comment.repliesData) && comment.repliesData.length > 0) {
    console.log('Rendering replies:', comment.repliesData);
    
    if (noRepliesMessage) {
      noRepliesMessage.style.display = 'none';
    }
    
    repliesList.innerHTML = comment.repliesData.map((reply, index) => {
      console.log(`Reply ${index}:`, reply);
      return `
        <div class="reply-item border-bottom pb-2 mb-2">
          <div class="d-flex justify-content-between align-items-start">
            <div class="flex-grow-1">
              <strong class="text-primary">@${reply.username || 'unknown'}</strong>
              <p class="mb-1 mt-1">${reply.text || 'No text'}</p>
            </div>
            <span class="badge bg-light text-dark ms-2">
              <i class="bi bi-heart-fill text-danger"></i> ${reply.likes || 0}
            </span>
          </div>
        </div>
      `;
    }).join('');
  } else {
    console.log('No replies found or empty array');
    if (noRepliesMessage) {
      noRepliesMessage.style.display = 'block';
    }
    repliesList.innerHTML = '';
  }
    
    // Show/hide sections
    document.getElementById('analysisError').style.display = comment.lastError ? 'block' : 'none';
    if (comment.lastError) {
      document.getElementById('analysisErrorMessage').textContent = comment.lastError;
    }
    document.getElementById('nonPostedNotice').style.display = 'none';
    
  } else {
    // Comment is not posted or doesn't have analysis data
    document.getElementById('nonPostedNotice').style.display = 'block';
    document.getElementById('nonPostedCurrentStatus').textContent = comment.status || 'unknown';
    document.getElementById('nonPostedCurrentStatus').className = `badge bg-${getStatusColor(comment.status)}`;
    
    // Hide analysis sections
    document.getElementById('analysisError').style.display = 'none';
    
    // Show placeholder values
    document.getElementById('analysisLikes').textContent = '—';
    document.getElementById('analysisReplies').textContent = '—';
    document.getElementById('analysisTotalEngagement').textContent = '—';
    document.getElementById('analysisLastAnalyzed').textContent = 'N/A';
    document.getElementById('repliesCount').textContent = 0;
    document.getElementById('repliesList').innerHTML = '';
    document.getElementById('noRepliesMessage').style.display = 'block';
    
    document.getElementById('analysisStatusBadge').className = 'badge bg-secondary me-2';
    document.getElementById('analysisStatusBadge').textContent = 'Not Available';
    document.getElementById('analysisStatusText').textContent = 'Comment must be posted first';
  }
  
  // Store current comment ID for refresh
  document.getElementById('commentAnalysisModal').dataset.commentId = comment.id;
}

// Helper function to get status color
function getStatusColor(status) {
  const colors = {
    'pending': 'warning',
    'approved': 'success',
    'processing': 'primary',
    'posted': 'info',
    'rejected': 'danger',
    'error': 'danger'
  };
  return colors[status] || 'secondary';
}
  function createCommentCard(comment) {
    const status = (comment.status || '').toLowerCase();
    const badgeClass = getStatusBadgeClassSafe(status);
    const createdAtStr = new Date(comment.timestamp || comment.createdAt || Date.now()).toLocaleString('en-GB', {
      day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit'
    });
  
    // Actions by status
    let actionButtons = '';
    if (status === 'pending') {
      actionButtons = `
        <button class="btn btn-sm btn-success approve-btn" data-id="${comment.id}">
          <i class="bi bi-check-circle"></i> Approve
        </button>
        <button class="btn btn-sm btn-danger reject-btn" data-id="${comment.id}">
          <i class="bi bi-x-circle"></i> Reject
        </button>`;
    } else if (status === 'approved') {
      actionButtons = `
        <button class="btn btn-sm btn-primary post-btn" data-id="${comment.id}">
          <i class="bi bi-send"></i> Post Comment
        </button>
        <button class="btn btn-sm btn-danger reject-btn" data-id="${comment.id}">
          <i class="bi bi-x-circle"></i> Reject
        </button>`;
    } else if (status === 'processing') {
      actionButtons = `
        <button class="btn btn-sm btn-outline-primary" disabled>
          <i class="bi bi-hourglass-split"></i> Processing...
        </button>`;
    } else if (status === 'posted') {
      actionButtons = `
        <button class="btn btn-sm btn-outline-info analyze-btn" data-id="${comment.id}">
          <i class="bi bi-graph-up"></i> View Analysis
        </button>
        <button class="btn btn-sm btn-outline-secondary refresh-btn" data-id="${comment.id}">
          <i class="bi bi-arrow-clockwise"></i> Refresh
        </button>`;
    } else if (status === 'error') {
      actionButtons = `
        <button class="btn btn-sm btn-primary post-btn" data-id="${comment.id}">
          <i class="bi bi-send"></i> Retry Post
        </button>`;
    }
  
    // History
    let statusHistory = '';
    if (comment.history && comment.history.length) {
      const hist = comment.history.map(h => `
        <span class="badge ${getStatusBadgeClassSafe(h.status)}">${h.status}</span>
        <span>${new Date(h.timestamp).toLocaleString()}</span>
      `).join(' → ');
      statusHistory = `<div class="status-history"><small><i class="bi bi-clock-history"></i> Status history: ${hist}</small></div>`;
    }
  
    const modelBadge = comment.model ? `<span class="badge bg-secondary json-model-badge">${comment.model}</span>` : '';
  
    // Engagement pills (likes/replies only live for posted)
   // Around line where you create engagement pills, replace with:
const likes = comment.likes || 0;
const replies = comment.repliesCount || 0;
const hasAnalysis = comment.likes !== undefined || comment.repliesCount !== undefined;
const disabled = (status === 'posted' && hasAnalysis) ? '' : 'disabled';
const titleLikes = (status === 'posted' && hasAnalysis) ? `${likes} Likes` : 'Available when posted and analyzed';
const titleReplies = (status === 'posted' && hasAnalysis) ? `${replies} Replies` : 'Available when posted and analyzed';
  
    const el = document.createElement('div');
    el.className = `card comment-card ${status}`;
    el.dataset.id = comment.id;
  
    el.innerHTML = `
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="badge ${badgeClass} text-uppercase">${comment.status}</span>
          <small class="text-muted">${createdAtStr} ${modelBadge}</small>
        </div>
  
        <div class="section-name">Post link</div>
        <div class="post-id">
          <a href="https://www.instagram.com/p/${comment.postId}/" target="_blank" class="badge post-id-badge">
            ${comment.postId}
          </a>
        </div>
  
        <div class="section-name">Post Username</div>
        <p class="post-caption">${comment.postUsername}</p>
  
        <div class="section-name">Post Caption</div>
        <p class="post-caption">${comment.postCaption}</p>
  
        <div class="section-name">Comment</div>
        <p class="card-text">${comment.comment}</p>
  
        ${statusHistory}
  
        <div class="d-flex justify-content-between align-items-center mt-2">
          <div></div>
          <div class="engagement-pills" data-engagement>
            <span class="engagement-pill likes ${disabled}" title="${titleLikes}" aria-disabled="${status!=='posted'}">
              <i class="bi bi-hand-thumbs-up"></i> <span class="like-count">${likes}</span>
            </span>
            <span class="engagement-pill replies ${disabled}" title="${titleReplies}" aria-disabled="${status!=='posted'}">
              <i class="bi bi-reply"></i> <span class="reply-count">${replies}</span>
            </span>
          </div>
        </div>
  
        <hr>
        <div class="btn-toolbar">
          <button class="btn btn-sm btn-outline-secondary edit-btn me-2" data-id="${comment.id}">
            <i class="bi bi-pencil"></i> Edit
          </button>
          ${actionButtons}
        </div>
      </div>`;
  
    // If you added the helper earlier
    if (typeof applyEngagement === 'function') applyEngagement(el, comment);
  
    return el;
  }
  
  // Update statistics
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
  
    // 1) Start with all comments
    let filtered = [...comments];
  
    // 2) Status filter
    if (currentStatusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === currentStatusFilter);
    }
  
    // 3) User filter
    if (currentUserFilterType === 'user') {
      const userFilters = stateManager.getUserFilters()
        .map(u => (typeof u === 'object' ? u.username : u))
        .map(u => u.trim().replace(/^@/, '').toLowerCase());
      if (userFilters.length) {
        filtered = filtered.filter(c =>
          userFilters.includes((c.username || '').trim().replace(/^@/, '').toLowerCase())
        );
      }
    }
  
    // Sort by timestamp desc
    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
    if (!filtered.length) {
      commentsContainer.innerHTML = `
        <div class="alert alert-info">
          <i class="bi bi-info-circle"></i> No comments match your filters.
        </div>`;
      return;
    }
  
    // 4) Build cards via the helper (NO const card / formattedDate here)
    filtered.forEach(comment => {
      const cardEl = createCommentCard(comment);
      commentsContainer.appendChild(cardEl);
    });
  
    // 5) Listeners (reuse your existing, but prefer e.currentTarget)
    document.querySelectorAll('.approve-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const button = e.currentTarget;
        const id = button.dataset.id;
        try {
          button.disabled = true;
          button.innerHTML = '<i class="bi bi-hourglass"></i> Approving...';
          await api.approveComment(id);
          loadComments();
        } catch (error) {
          alert(`Error approving comment: ${error.message}`);
          button.disabled = false;
          button.innerHTML = '<i class="bi bi-check-circle"></i> Approve';
        }
      });
    });
  
    document.querySelectorAll('.reject-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        if (!confirm('Are you sure you want to reject this comment?')) return;
        try {
          await api.rejectComment(id);
          loadComments();
        } catch (error) {
          alert(`Error rejecting comment: ${error.message}`);
        }
      });
    });
  
    document.querySelectorAll('.post-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const button = e.currentTarget;
        const id = button.dataset.id;
        try {
          button.disabled = true;
          button.innerHTML = '<i class="bi bi-hourglass"></i> Posting...';
          await api.postComment(id);
          loadComments();
        } catch (error) {
          alert(`Error posting comment: ${error.message}`);
          button.disabled = false;
          button.innerHTML = '<i class="bi bi-send"></i> Post Comment';
        }
      });
    });
  
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        try {
          const comment = await api.getCommentById(id);
          editCommentIdInput.value = comment.id;
          commentTextArea.value    = comment.comment;
          postCaptionArea.value    = comment.postCaption;
          postIdInput.value        = comment.postId;
          editModal.show();
        } catch (error) {
          alert(`Error loading comment details: ${error.message}`);
        }
      });
    });
  
    // NEW: analysis + refresh for posted
   // In the renderComments function, update the analyze button listener:
document.querySelectorAll('.analyze-btn').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    const id = e.currentTarget.dataset.id;
    console.log('Opening analysis for comment ID:', id);
    
    try {
      // Find comment in local array first (faster)
      let comment = comments.find(c => c.id === id);
      
      // If not found locally or needs refresh, fetch from API
      if (!comment) {
        console.log('Comment not in local cache, fetching from API');
        comment = await api.getCommentById(id);
      }
      
      console.log('Comment to analyze:', comment);
      
      fillAnalysisModal(comment);
      const modal = new bootstrap.Modal(document.getElementById('commentAnalysisModal'));
      modal.show();
    } catch (error) {
      console.error('Error loading analysis:', error);
      alert(`Error loading analysis: ${error.message}`);
    }
  });
});
  
    document.querySelectorAll('.refresh-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const button = e.currentTarget;
        const id = button.dataset.id;
        try {
          button.disabled = true;
          button.innerHTML = '<i class="bi bi-arrow-repeat"></i> Refreshing...';
          await api.refreshCommentMetrics(id); // ensure this exists on your backend
          loadComments();
        } catch (error) {
          alert(`Error refreshing: ${error.message}`);
          button.disabled = false;
          button.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refresh';
        }
      });
    });
  }
  
  
  // Helper function to get status badge class
  // Status → badge class
const STATUS_BADGE = {
  pending:    'bg-warning text-dark',
  approved:   'bg-success',
  processing: 'bg-primary',
  posted:     'bg-info',
  rejected:   'bg-danger',
  error:      'bg-warning text-dark'
};

function getStatusBadgeClassSafe(status) {
  return STATUS_BADGE[(status || '').toLowerCase()] || 'bg-secondary';
}

  function updateFilterBanner() {
    if (currentUserFilterType === 'user') {
      api.getFilteredUsers().then(users => {
        // Handle both array responses and object responses
        let userList = [];
        
        if (Array.isArray(users)) {
          userList = users;
        } else if (users && typeof users === 'object' && Array.isArray(users.filteredUsers)) {
          userList = users.filteredUsers;
        } else if (users && typeof users === 'object' && Array.isArray(users.users)) {
          userList = users.users;
        }
        
        // Handle both object-style users and string-style users
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
          
        // Add clear filter button handler
        document.getElementById('clearUserFiltersBtn')?.addEventListener('click', () => {
          currentUserFilterType = 'all';
          filterOptionDropdown.value = 'all';
          renderComments();
          updateFilterBanner();
        });
      });
    } else {
      // Check if we're logged in
      const username = stateManager.getUsername();
      const loggedIn = stateManager.getLoginState().loggedIn;
      
      if (username && loggedIn) {
        dataSourceInfo.innerHTML = `
          <div class="alert alert-success">
            <i class="bi bi-check-circle"></i> Connected to Instagram as @${username}
            <span class="badge bg-secondary ms-2">${comments.length} comments</span>
          </div>`;
      } else if (username && !loggedIn) {
        dataSourceInfo.innerHTML = `
          <div class="alert alert-warning">
            <i class="bi bi-exclamation-triangle"></i> Please connect your Instagram account to view comments
          </div>`;
      } else {
        dataSourceInfo.innerHTML = `
          <div class="alert alert-info">
            <i class="bi bi-info-circle"></i> Please set your Instagram username to continue
          </div>`;
      }
    }
  }


  
  // Save comment button handler
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
  
  // Generate new comment button handler
  generateCommentBtn.addEventListener('click', async () => {
    const postId = document.getElementById('newPostId').value;
    const caption = document.getElementById('newPostCaption').value;
    
    if (!postId.trim() || !caption.trim()) {
      alert('Post ID and caption are required');
      return;
    }
    
    try {
      // Update button state
      generateCommentBtn.disabled = true;
      generateCommentBtn.innerHTML = '<i class="bi bi-hourglass"></i> Generating...';
      
      const result = await api.generateComment(postId, caption);
      newCommentModal.hide();
      
      // Reset form
      document.getElementById('newPostId').value = '';
      document.getElementById('newPostCaption').value = '';
      
      // Reset button
      generateCommentBtn.disabled = false;
      generateCommentBtn.innerHTML = 'Generate Comment';
      
      // Reload comments to show the new one
      loadComments();
    } catch (error) {
      alert(`Error generating comment: ${error.message}`);
      generateCommentBtn.disabled = false;
      generateCommentBtn.innerHTML = 'Generate Comment';
    }
  });
  
  // Refresh button handler
  refreshBtn.addEventListener('click', async () => {
    try {
      // Show loading state
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Loading...';
      
      await loadComments();
    } catch (error) {
      console.error('Error refreshing comments:', error);
    } finally {
      // Reset button state
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refresh';
    }
  });
  
  // Add new comment button handler
  addNewCommentBtn.addEventListener('click', () => {
    newCommentModal.show();
  });
  
  // Instagram login button handler
  instagramLoginBtn.addEventListener('click', handleInstagramLogin);
  
  // Login prompt button handler
  loginPromptBtn.addEventListener('click', handleInstagramLogin);
  
  // Username button handlers
  usernameBtn.addEventListener('click', () => {
    // Pre-fill with current username
    document.getElementById('modalInstagramUsername').value = stateManager.getUsername();
    usernameModal.show();
  });
  
  saveUsernameBtn.addEventListener('click', () => {
    const username = document.getElementById('instagramUsername').value;
    saveUsername(username);
  });
  
  saveModalUsernameBtn.addEventListener('click', () => {
    const username = document.getElementById('modalInstagramUsername').value;
    saveUsername(username);
  });
  
  
// Add this near the end, before the closing of DOMContentLoaded
document.getElementById('refreshAnalysisBtn')?.addEventListener('click', async () => {
  const commentId = document.getElementById('commentAnalysisModal').dataset.commentId;
  if (!commentId) return;
  
  const btn = document.getElementById('refreshAnalysisBtn');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Refreshing...';
  btn.disabled = true;
  
  try {
    await loadComments();
    const comment = comments.find(c => c.id === commentId);
    if (comment) {
      fillAnalysisModal(comment);
    }
  } catch (error) {
    console.error('Error refreshing analysis:', error);
    alert('Failed to refresh analysis data');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
});
  checkInitialState();
    });