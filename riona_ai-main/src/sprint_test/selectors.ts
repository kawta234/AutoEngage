// selectors.ts

// Sélecteur pour cibler un article (post) en fonction d'un index donné
export const postSelector = (index: number = 0): string => `article:nth-of-type(${index + 1})`;

// Sélecteurs de légende (caption) utilisés pour extraire la légende d'un post
export const captionSelectors: string[] = [
  'span.x193iq5w.xeuugli.x1fj9vlw.x13faqbe.x1vvkbs.xt0psk2.x1i0vuye.xvs91rp.xo1l8bm.x5n08af.x10wh9bi.x1wdrske.x8viiok.x18hxmgj',
  'div.C4VMK > span'
];

// Sélecteur pour le lien "more" qui permet d'étendre la légende
export const moreLinkSelector: string = 'span.x1lliihq';

// Sélecteur pour la zone de commentaire
export const commentBoxSelector: string = 'textarea[aria-label="Add a comment…"][placeholder="Add a comment…"]';
