# Nexura Card Delivery Platform

Plateforme fintech premium de **suivi d'expédition de cartes de débit** — **aucune fonction
bancaire, transaction, paiement ou numéro de carte réel n'est implémentée.**
Interface utilisateur en espagnol.

Le front-end (HTML/CSS/JS) est servi par un vrai **serveur Node.js (Express)**, adossé à une
**vraie base de données PostgreSQL** hébergée gratuitement (Neon, Supabase, ou tout Postgres
compatible). Il n'y a plus de `localStorage` : toutes les données (envíos, agentes, clientes,
notificaciones, configuración, historial) vivent dans une vraie base de données, garantie
persistante indépendamment de l'hébergement du serveur applicatif.

## 1. Créer la base de données (Neon, gratuit)

1. Va sur **neon.tech** → crée un compte → "Create a project"
2. Une fois le projet créé, copie la **connection string** affichée (elle ressemble à
   `postgres://user:password@ep-xxxx.neon.tech/dbname?sslmode=require`)
3. Garde-la de côté — c'est ta variable `DATABASE_URL`

*(Supabase fonctionne aussi de façon identique : Project Settings → Database → Connection
string → mode "URI".)*

## 2. Démarrage rapide (local)

```bash
cd server
npm install
cp .env.example .env
# édite .env et colle ta DATABASE_URL
npm start
```

Puis ouvre **http://localhost:3000**. Le serveur sert à la fois le front-end et l'API — pas
besoin d'ouvrir `index.html` directement, il faut passer par le serveur.

Au premier démarrage, les tables sont créées automatiquement et pré-remplies avec des données
de démonstration.

- **Portail Client** — entre un code de suivi (visible dans la table des expéditions côté admin
  après connexion, ou généré à chaque nouvelle expédition créée)
- **Portail Administrateur** — identifiants par défaut : `admin@nexura.app` / `Eur@059535`
  (change-les via les variables d'environnement avant tout déploiement public, voir plus bas)

## 3. Déployer (Render)

1. Mets le code sur GitHub (bouton "Upload files" sur un nouveau dépôt vide fonctionne très
   bien depuis un téléphone)
2. Sur **render.com** → connecte-toi avec GitHub → "New +" → "Web Service" → choisis le dépôt
3. Configure :

   | Champ | Valeur |
   |---|---|
   | Root Directory | `server` |
   | Build Command | `npm install` |
   | Start Command | `npm start` |

4. Variables d'environnement (section "Environment") :

   | Clé | Valeur |
   |---|---|
   | `DATABASE_URL` | ta connection string Neon/Supabase |
   | `ADMIN_EMAIL` | `admin@nexura.app` |
   | `ADMIN_PASSWORD` | `Eur@059535` (ou change-le) |
   | `NODE_ENV` | `production` |

5. "Create Web Service" — Render installe et démarre tout seul (~2-3 min)

Tu obtiens une URL du type `https://nexura-card-delivery.onrender.com`. Les données créées
dessus restent en base Neon/Supabase, **indépendamment du serveur applicatif** : même si Render
redémarre, réinitialise ou redéploie le service, rien n'est perdu.

## Changer les identifiants administrateur

1. Définis `ADMIN_EMAIL` et `ADMIN_PASSWORD` dans les variables d'environnement **avant** le
   tout premier démarrage (elles ne servent qu'à créer le compte initial en base)
2. Si le serveur a déjà démarré une fois, ces variables n'ont plus d'effet : modifie
   directement la table `admins` en SQL (depuis l'éditeur SQL de Neon/Supabase), ou vide la
   table `admins` pour forcer une recréation au prochain démarrage

## Structure du projet

```
nexura-card-delivery/
├── index.html                 Connexion (portail client / admin) + splash screen
├── css/style.css              Design system (glassmorphism, thèmes clair/sombre, composants)
├── js/
│   ├── data-service.js        Client REST (appelle l'API du serveur)
│   ├── shell.js                Icônes, helpers, navigation du portail client
│   └── admin-shell.js          Navigation du portail administrateur
├── client/                    Pages du portail client (dashboard, historique, notifications)
├── admin/                     Pages du portail administrateur
├── assets/                     Logo et favicon Nexura (SVG, vectoriel)
└── server/                    Back-end Node.js + Express + PostgreSQL
    ├── server.js                Point d'entrée : routes API + fichiers statiques
    ├── db.js                    Schéma SQL, données de démonstration, utilitaires
    ├── env.js                   Petit chargeur de fichier .env (sans dépendance)
    ├── package.json
    └── .env.example
```

## Architecture des données

Le code métier (créer une expédition, faire avancer une étape, envoyer une notification...)
vit dans `server/server.js`, qui lit et écrit dans `server/db.js` (PostgreSQL via le driver
`pg`). Le front-end ne fait que des appels HTTP via `fetch()` — voir `js/data-service.js`, qui
garde les mêmes noms de méthodes qu'avant (`getShipments()`, `createShipment()`, etc.) pour
qu'aucune page n'ait besoin d'être réécrite.

`DATABASE_URL` est la seule variable qui détermine la base utilisée : Neon, Supabase, un
PostgreSQL Render, ou une instance auto-hébergée fonctionnent tous de façon identique tant que
le format de connection string standard est respecté.

## Sécurité

- Authentification par cookie de session **httpOnly**, stocké côté serveur (table `sessions`)
- Mots de passe administrateur hachés (`scrypt`, jamais stockés en clair)
- Séparation stricte des rôles client / administrateur (middlewares `requireAdmin` /
  `requireClient`)
- Le code de suivi agit comme identifiant client (comme un vrai numéro de colis) — connaître
  le code donne accès au suivi correspondant, sans mot de passe séparé
- Journal d'activité administrateur (table `activity_log`)
- Connexion à la base chiffrée (`sslmode=require`)

## Garde-fous

Conformément au périmètre demandé, cette plateforme **ne traite aucune donnée bancaire
réelle** : pas de transactions, pas de comptes, pas de numéros de carte réels, pas de
virements. Toutes les données affichées (clients, agents, expéditions) sont fictives et
générées à des fins de démonstration.
