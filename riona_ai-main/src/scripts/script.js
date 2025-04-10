// script.js
let posts = [];
let comments = [];

// Fonction pour afficher les posts
const displayPosts = () => {
  const postsContainer = document.getElementById('posts-container');
  postsContainer.innerHTML = '';
  posts.forEach((post) => {
    const postElement = document.createElement('div');
    postElement.classList.add('post');
    postElement.innerHTML = post.text;
    postsContainer.appendChild(postElement);
  });
};

// Fonction pour afficher les commentaires
const displayComments = () => {
  const commentContainer = document.getElementById('comment-container');
  commentContainer.innerHTML = '';
  comments.forEach((comment) => {
    const commentElement = document.createElement('div');
    commentElement.classList.add('comment');
    commentElement.innerHTML = comment.text;
    commentContainer.appendChild(commentElement);
  });
};

// Fonction pour générer les commentaires
const generateComments = () => {
  // Appeler l'API LLaMA pour générer les commentaires
  const llama = new LLaMA({
    apiKey: 'YOUR_API_KEY',
    model: 'llama-3.1',
  });

  llama.generate({
    prompt: 'Générer des commentaires pour les posts',
    maxTokens: 128,
    temperature: 0.7,
    topP: 0.9,
  })
  .then((response) => {
    comments = response.text.split('\n').map((comment) => {
      return { text: comment };
    });
    displayComments();
  })
  .catch((error) => {
    console.error(error);
  });
};

// Fonction pour valider les commentaires
const validateComments = () => {
  // Appeler l'API Instagram pour poster les commentaires
  const browser = puppeteer.launch();
  const page = browser.newPage();
  page.goto(`https://www.instagram.com/`);

  comments.forEach((comment) => {
    // Poster le commentaire
    const commentInput = page.$(`textarea[placeholder="Ajouter un commentaire"]`);
    commentInput.type(comment.text);
    const postButton = page.$(`button[type="submit"]`);
    postButton.click();
  });

  browser.close();
};

// Écouteurs d'événements
document.getElementById('generate-button').addEventListener('click', generateComments);
document.getElementById('validate-button').addEventListener('click', validateComments);

// Initialisation
displayPosts();
