# JM POISSONNERIE — Plateforme e-commerce

Boutique en ligne + livraison + back-office pour **JM Poissonnerie** (poisson, carpes, poulet, rognons, tripes…).
Direction artistique tirée des affiches : bleu marine / bleu électrique, rouge réservé aux promotions, ambiance « fraîcheur ».

**Stack** : Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind CSS 4 · PostgreSQL (compatible Supabase) · sharp (images) · pdfkit (factures).

## Démarrage rapide

```bash
npm install
cp .env.example .env.local        # adapter DATABASE_URL
npm run db:reset                  # crée le schéma + (re)charge les données de démonstration
npm run dev                       # http://localhost:3000
```

PostgreSQL local rapide : `createuser jm -P && createdb jm -O jm` (mot de passe `jm`), ou utilisez la chaîne de connexion de votre projet **Supabase** / Neon / Railway.

Base vide pour la production (sans données de démo) :

```bash
npm run db:migrate
SEED_ADMIN_PHONE=2250710369975 SEED_ADMIN_PASSWORD='un-mot-de-passe-long' npx tsx scripts/seed.ts --minimal
```

### Comptes de démonstration (mot de passe `Jm@2026!`)

| Rôle | Téléphone |
|---|---|
| Super admin | 07 00 00 00 01 |
| Gérant | 07 00 00 00 02 |
| Gestionnaire stock | 07 00 00 00 03 |
| Préparateur | 07 00 00 00 04 |
| Livreurs | 07 00 00 00 11 / 12 / 13 |
| Clients | 07 00 00 01 00 … 07 |

⚠️ **Supprimez/changez ces comptes avant la mise en production.**

## Où est quoi

| Espace | URL | Rôles |
|---|---|---|
| Boutique | `/`, `/produits`, `/promotions`, `/livraison`, `/contact` | public |
| Panier / commande | `/panier`, `/commande` | compte client |
| Mon espace | `/mon-espace/*` (commandes, suivi, adresses, favoris, notifications, factures, profil) | client |
| Espace livreur (mobile) | `/livreur` | livreur |
| Back-office | `/admin/*` | super admin, gérant, stock, préparateur (selon permissions) |

Tout le catalogue (catégories, produits, unités, prix, promotions, photos), les zones de livraison, les horaires, le logo, le numéro **WhatsApp** (*Paramètres → Contact*) et les moyens de paiement sont modifiables **sans toucher au code**.

## Fonctionnement métier

* **Unités de vente** : kg (pas de 500 g, quantité libre possible), pièce, paquet, plateau, personnalisée. Prix calculé automatiquement (500 g = 700 FCFA pour 1 400 FCFA/kg). Variantes optionnelles (ex. tailles de poulet).
* **Stock** : *en rayon* / *réservé* / *vendu* / *restant disponible*. Commande → réservation (verrou SQL anti-survente) ; livraison → sortie définitive ; annulation → libération. Alerte automatique sous le seuil (notification gérant + stock), et notification « de retour en stock » aux clients qui ont le produit en favori.
* **Commande** : `JM-AAAAMMJJ-0001` → reçue → paiement confirmé → préparation → (prête / remise au livreur) → en livraison → livrée (ou échec / annulée). Chaque transition est horodatée dans `delivery_status_history` et notifie le client.
* **Livraison** : zones & tarifs administrables (+ supplément express, seuil de gratuité), code de livraison à 4 chiffres remis au livreur, preuve (photo + commentaire), échec avec motif, GPS temps réel **optionnel** (le livreur active le partage ; le client déclenche l'affichage de la carte → aucune donnée consommée par défaut).
* **Authentification** : téléphone + mot de passe, **sans OTP**. Mots de passe hashés *scrypt* salés. « Mot de passe oublié » sans SMS : le client demande, le gérant génère un code à 6 chiffres à usage unique (valable 1 h) depuis *Clients & équipe* et le lui transmet (appel/WhatsApp).
* **Paiement** : paiement à la livraison, Mobile Money manuel (le client indique sa référence, le gérant confirme), et **CinetPay** (Orange Money, MTN, Moov, Wave, cartes) prêt à l'emploi : renseigner les clés (voir ci-dessous). Le webhook ne fait jamais confiance au corps reçu : il re-vérifie la transaction auprès de CinetPay.
* **Facture** : générée à chaque commande (numéro `F-AAAA-000001`, instantané immuable), PDF téléchargeable côté client et gérant.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | connexion PostgreSQL (Supabase : *Settings → Database*) |
| `DATABASE_SSL` | `true` si la base exige SSL |
| `NEXT_PUBLIC_SITE_URL` | URL publique (SEO, sitemap, retour de paiement) |
| `UPLOAD_DIR` | dossier des photos téléversées (volume persistant en production) |
| `DEFAULT_COUNTRY_CODE` | indicatif par défaut pour les numéros locaux (défaut `225`) |
| `CINETPAY_API_KEY`, `CINETPAY_SITE_ID` | **à renseigner ici** pour activer le paiement en ligne |

URL de notification CinetPay à déclarer dans leur tableau de bord : `https://VOTRE-DOMAINE/api/payments/cinetpay`.

## Sécurité

* **Droits côté serveur** : table `roles` (permissions en base) ; **chaque** server action / route API appelle `requirePerm(...)`. Masquer un bouton n'est jamais la seule protection (testé en E2E). Sessions en base (jeton aléatoire haché SHA-256, cookie `httpOnly`, `sameSite=lax`, `secure` en prod) révocables.
* Validation serveur systématique (zod), requêtes SQL **paramétrées** (aucune concaténation de valeurs utilisateur), échappement React (XSS), CSP + en-têtes de sécurité (`next.config.ts`), protection CSRF native des Server Actions (contrôle d'origine).
* **Rate limiting** persistant en base : connexion (par numéro et par IP), inscription, mot de passe oublié/réinitialisation, commandes, GPS.
* **Uploads** : taille ≤ 6 Mo, type vérifié sur la *signature binaire réelle*, ré-encodage WebP (supprime EXIF/contenu caché), service par route validée (anti path-traversal).
* **Journal d'audit** (`audit_logs`) : connexions staff/échecs, prix, stock, statuts de commande, paiements, rôles, paramètres, codes de réinitialisation…
* Row Level Security : non utilisée car le navigateur n'accède **jamais** directement à la base (tout passe par le serveur Next.js avec rôle applicatif). Si vous exposez un jour la base via le SDK Supabase côté client, activez RLS avant.

## Tests

```bash
npm run dev            # dans un terminal
npm run test:e2e       # parcours réels : inscription → commande → préparation → livraison → avis, rôles, stock, sécurité
```

## Hypothèses à confirmer

* Pays/devise déduits des affiches : **Côte d'Ivoire, FCFA, numéros +225**. La **ville** n'apparaît pas sur les affiches → à renseigner dans *Paramètres → Contact* (utilisée par le SEO local).
* Seuls 4 prix viennent des affiches (carpe 1 400, rognon 1 700, tripes 1 500, tête de porc 1 000 FCFA/kg). Les autres prix, stocks, clients, commandes et avis sont des **données de démonstration**.
* Les photos des produits sont des recadrages des affiches fournies : remplacez-les par vos vraies photos depuis *Produits → modifier*.
* Zones de livraison A/B/C (1 000 / 1 500 / 2 500 FCFA) : exemples à ajuster.
