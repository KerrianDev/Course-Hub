# Course Hub

Petite web-app privée pour centraliser tes cours par matière et chapitre.

## Fonctionnalités

- Compte utilisateur Supabase
- Matières
- Chapitres
- Upload de plusieurs fichiers
- PDF, PowerPoint et autres fichiers
- Fichiers privés
- Liens temporaires pour ouvrir les documents
- Suppression des matières, chapitres et fichiers
- Responsive PC / téléphone

## 1. Créer le projet Supabase

1. Crée un projet Supabase.
2. Ouvre **SQL Editor**.
3. Copie tout le contenu de `supabase.sql`.
4. Exécute le script.

Le bucket `course-files` est créé en privé et les politiques RLS empêchent un utilisateur d'accéder aux fichiers d'un autre.

## 2. Configurer le site

À la racine du projet :

```bash
npm install
```

Copie `.env.example` vers `.env`, puis remplace les deux valeurs :

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Les valeurs sont disponibles dans les paramètres API de ton projet Supabase.

## 3. Tester

```bash
npm run dev
```

Ouvre l'adresse indiquée par Vite.

## 4. Mettre en ligne

Le projet est compatible avec Vercel, Netlify ou Cloudflare Pages.

Commande de build :

```bash
npm run build
```

Dossier de sortie :

```text
dist
```

Ajoute également `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans les variables d'environnement de l'hébergeur.

## Remarque PowerPoint

Un navigateur sait afficher nativement les PDF beaucoup mieux que les fichiers `.pptx`.
Course Hub stocke quand même les PowerPoint et permet de les ouvrir/télécharger via leur URL privée temporaire.
Pour une consultation parfaite directement dans le navigateur, exporter les diapos en PDF reste le plus fiable.
