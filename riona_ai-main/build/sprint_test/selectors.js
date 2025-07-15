"use strict";
// selectors.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.commentBoxSelector = exports.moreLinkSelector = exports.captionSelectors = exports.postSelector = void 0;
// Sélecteur pour cibler un article (post) en fonction d'un index donné
const postSelector = (index = 0) => `article:nth-of-type(${index + 1})`;
exports.postSelector = postSelector;
// Sélecteurs de légende (caption) utilisés pour extraire la légende d'un post
exports.captionSelectors = [
    'span.x193iq5w.xeuugli.x1fj9vlw.x13faqbe.x1vvkbs.xt0psk2.x1i0vuye.xvs91rp.xo1l8bm.x5n08af.x10wh9bi.x1wdrske.x8viiok.x18hxmgj',
    'div.C4VMK > span'
];
// Sélecteur pour le lien "more" qui permet d'étendre la légende
exports.moreLinkSelector = 'span.x1lliihq';
// Sélecteur pour la zone de commentaire
exports.commentBoxSelector = 'textarea[aria-label="Add a comment…"][placeholder="Add a comment…"]';
