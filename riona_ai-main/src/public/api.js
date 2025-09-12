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
      try {
        await triggerFifo(username);
        console.log('FIFO process initiated for username:', username);
        // Optional: show success toast
        if (typeof showToast === 'function') {
          showToast('success', 'Automated comment processing started');
        }
      } catch (fifoError) {
        console.error('Error triggering FIFO process:', fifoError);
        // Optional: show warning toast, but don't break the flow with an alert
        if (typeof showToast === 'function') {
          showToast('warning', 'Problem with automated comment processing');
        }
      }
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
    // First, handle cookie storage through the login API
    const loginResult = await api.instagramLogin(username);
    
    loginStatus.innerHTML = `
      <div class="alert alert-success">
        <i class="bi bi-check-circle-fill"></i> Cookies stored successfully!
        <p>Instagram agent is now running in the background...</p>
      </div>
    `;
    
    // Update both local state and UI after cookies are stored
    stateManager.saveLoginState(username);
    
    // Update UI and go to dashboard immediately
    setTimeout(() => {
      loginStatusModal.hide();
      isLoggedIn = true;
      updateUIState();
      loadComments();
    }, 2000);
    
    // Déclencher le processus FIFO en arrière-plan sans bloquer
    // Exactement comme runInstagramAgent
   
    
    // Run the Instagram agent in the background without waiting for it to finish
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
      return; // Don't load comments if not logged in or no username
    }
    
    try {
      const response = await api.fetchComments();
      
      // Handle the new API response structure
      if (response && Array.isArray(response.comments)) {
        comments = response.comments;
      } else if (Array.isArray(response)) {
        // Fallback for old API response format
        comments = response;
      } else {
        // Handle unexpected response format
        comments = [];
        console.warn('Unexpected API response format:', response);
      }
      
      // Update alert with success message and comment count
      const message = response.message || `${comments.length} comments loaded`;
      dataSourceInfo.innerHTML = `
        <div class="alert alert-success">
          <i class="bi bi-check-circle"></i> Connected to Instagram as @${stateManager.getUsername() || 'user'} 
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

  // Render comments based on current filter
 
    
    

    // Existing renderComments logic, but modify the user filtering part
    function renderComments() {
      
commentsContainer.innerHTML = '';

// 1) Start with all comments
let filtered = [...comments];

// 2) Apply status filter
if (currentStatusFilter !== 'all') {
filtered = filtered.filter(c => c.status === currentStatusFilter);
}

// 3) Apply user filter if requested
if (currentUserFilterType === 'user') {
// Get normalized usernames from filters
const userFilters = stateManager.getUserFilters()
  .map(u => {
    // Handle both string and object formats
    const username = typeof u === 'object' ? u.username : u;
    return username.trim().replace(/^@/, '').toLowerCase();
  });
 
// Only filter if we have filters defined
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
  return dateB - dateA; // Descending order (newest first)
});
// 4) Render "no results" or the cards
if (filtered.length === 0) {
commentsContainer.innerHTML = `
  <div class="alert alert-info">
    <i class="bi bi-info-circle"></i>
    No comments match your filters.
  </div>`;
return;
}

let hasLogged = false;
filtered.forEach(comment => {

 
    
    
      const card = document.createElement('div');
      card.className = `card comment-card ${comment.status}`;
      card.dataset.id = comment.id;
      
      // Format date
      const date = new Date(comment.timestamp);
      const formattedDate = date.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      // Determine badge color based on status
      let badgeClass = 'bg-secondary';
      if (comment.status === 'pending') badgeClass = 'bg-warning';
      if (comment.status === 'approved') badgeClass = 'bg-success';
      if (comment.status === 'processing') badgeClass = 'bg-primary';
      if (comment.status === 'posted') badgeClass = 'bg-info';
      if (comment.status === 'rejected') badgeClass = 'bg-danger';
      if (comment.status === 'error') badgeClass = 'bg-warning text-dark';
      
      // Determine action buttons based on status
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
      }
      
      // Build status history display
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
      
      // JSON/AI model badge
      const modelBadge = comment.model 
        ? `<span class="badge bg-secondary json-model-badge">${comment.model}</span>` 
        : '';
      
      card.innerHTML = `
        <div class="card-body">
          <!-- Section: Post ID -->
          <div class="section-name">Post link</div>
          <div class="post-id">
            <a
              href="https://www.instagram.com/p/${comment.postId}/"
              target="_blank"
              class="badge post-id-badge"
            >
              ${comment.postId}
            </a>
          </div>

          <!-- Section: Post Username -->
          <div class="section-name">Post Username</div>
          <p class="post-caption">${comment.postUsername}</p>

          <!-- Section: Post Caption -->
          <div class="section-name">Post Caption</div>
          <p class="post-caption">${comment.postCaption}</p>

          <!-- Section: Comment Text -->
          <div class="section-name">Comment </div>
          <p class="card-text">${comment.comment}</p>
          <div class="timestamp">
            ${formattedDate} ${modelBadge}
          </div>
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
    
    // Add event listeners to action buttons
    document.querySelectorAll('.approve-btn').forEach(btn => {
btn.addEventListener('click', async (e) => {
const id = e.target.closest('button').dataset.id;
try {
  // Show loading state
  const button = e.target.closest('button');
  button.disabled = true;
  button.innerHTML = '<i class="bi bi-hourglass"></i> Approving...';
  
  await api.approveComment(id);
  loadComments(); // Reload comments after successful approval
} catch (error) {
  alert(`Error approving comment: ${error.message}`);
  // Reset button on error
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
            loadComments(); // Reload all comments
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
commentTextArea.value    = comment.comment;    
postCaptionArea.value    = comment.postCaption;
postIdInput.value        = comment.postId;

  
  editModal.show();
} catch (error) {
  alert(`Error loading comment details: ${error.message}`);
}
});
});
  }
  
  // Helper function to get status badge class
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
  
  

  checkInitialState();
    });