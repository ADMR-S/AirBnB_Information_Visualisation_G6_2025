# Parallel Coordinates - Guide d'utilisation

## Fonctionnalités

### 🔍 Filtre par Host Name ou Host ID (HostParallelView)

**Recherchez et filtrez les données par nom d'hôte OU par ID d'hôte**

#### Comment utiliser:
1. Dans la page **Performance Comparison** (HostParallelView)
2. Entrez un nom d'hôte OU un ID d'hôte dans le champ "Filter by Host Name or ID"
3. La visualisation se met à jour en temps réel
4. Cliquez sur "Clear" pour réinitialiser

#### Caractéristiques:
- ✅ Recherche par **host_name** (ex: "John", "Michael")
- ✅ Recherche par **host_id** (ex: "12345", "98765") - **Plus précis**
- ✅ Recherche partielle pour les deux (ex: "123" trouve "12345")
- ✅ Insensible à la casse
- ✅ Mise à jour instantanée
- ✅ Affichage du nombre de résultats
- ✅ Compatible avec les autres filtres

#### Pourquoi host_id en plus de host_name ?
- **host_name** : Plusieurs personnes peuvent avoir le même nom → résultats moins précis
- **host_id** : Identifiant unique pour chaque hôte → résultats précis pour UN seul hôte
- Le filtre cherche dans les DEUX champs simultanément (logique OR)

#### Exemples:
```
Saisie: "John"        → Trouve tous les hôtes avec "John" dans le nom
Saisie: "12345"       → Trouve l'hôte avec l'ID "12345"
Saisie: "123"         → Trouve host_id contenant "123" ET host_name contenant "123"
```

#### Cas d'usage:
- **Par host_id** : Analyser TOUTES les propriétés d'un hôte spécifique (recommandé)
- **Par host_name** : Trouver tous les hôtes avec un nom similaire
- Comparer les métriques d'un hôte à la moyenne
- Identifier les patterns de prix/reviews pour un hôte
- Examiner la disponibilité des propriétés d'un hôte

---

## Contrôles communs

### Affichage
- **Afficher tout / Afficher échantillon**: Toggle entre vue complète et échantillon stratifié
- **Room Types**: Cliquez sur les badges pour filtrer par type de chambre

### Performance
- Mode échantillon: ~2000-12000 lignes (rapide)
- Mode complet: Toutes les données (peut être lent)
- Rendu par chunk: 1500 lignes à la fois pour fluidité

---

## Fichiers

- `HostParallelView.tsx` - Vue avec filtre par host_name/host_id
- `TravelerParallelView.tsx` - Vue standard
- `parallelCommon.ts` - Fonctions utilitaires partagées
- `parallel.css` - Styles

---

Dernière mise à jour: 2025-11-01
