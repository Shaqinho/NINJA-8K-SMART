# 🔐 NINJA 8K - Google Sheets Anti-Piracy Setup

## 📋 Vue d'ensemble

Ce système envoie automatiquement les données d'activation vers TON Google Sheet personnel.
Tu pourras voir tous les utilisateurs premium, détecter le piratage, et gérer les activations.

---

## ⏱️ Temps requis : 5-10 minutes

---

## 📝 Étape 1 : Créer le Google Sheet

1. Va sur [Google Sheets](https://sheets.google.com)
2. Crée un nouveau spreadsheet
3. Nomme-le : `NINJA 8K - Activations`
4. Dans la première ligne (Row 1), ajoute ces en-têtes :

```
A1: Timestamp
B1: MAC
C1: Device Key
D1: UUID
E1: Activation Code
F1: Status
G1: Platform
H1: Model
I1: Manufacturer
J1: OS Version
K1: App Version
L1: Country
```

5. **Note l'ID du spreadsheet** (dans l'URL) :
   ```
   https://docs.google.com/spreadsheets/d/XXXXXXXXXXXXXXXXXXXXX/edit
                                          ↑ C'est ça l'ID
   ```

---

## 📝 Étape 2 : Créer le Google Apps Script

1. Dans ton Google Sheet, va dans : **Extensions → Apps Script**

2. Supprime tout le code existant et colle ceci :

```javascript
// NINJA 8K - Activation Logger
// This script receives activation data and logs it to the spreadsheet

const SPREADSHEET_ID = 'PASTE_YOUR_SPREADSHEET_ID_HERE'; // ← Remplace par ton ID
const SHEET_NAME = 'Sheet1'; // ou le nom de ta feuille

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    const data = JSON.parse(e.postData.contents);
    
    // Append row with activation data
    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.mac || '',
      data.deviceKey || '',
      data.uuid || '',
      data.activationCode || '',
      data.status || '',
      data.platform || '',
      data.model || '',
      data.manufacturer || '',
      data.osVersion || '',
      data.appVersion || '',
      data.country || '',
    ]);
    
    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput('NINJA 8K Activation Logger is running!')
    .setMimeType(ContentService.MimeType.TEXT);
}
```

3. **Remplace** `PASTE_YOUR_SPREADSHEET_ID_HERE` par l'ID de ton spreadsheet

4. Sauvegarde (Ctrl+S ou Cmd+S)

---

## 📝 Étape 3 : Déployer le Script

1. Clique sur **Deploy → New deployment**

2. Configure :
   - Type : **Web app**
   - Description : `NINJA 8K Activation Logger`
   - Execute as : **Me**
   - Who has access : **Anyone** (nécessaire pour que l'app puisse envoyer)

3. Clique **Deploy**

4. **Autorise** l'accès quand demandé (c'est ton propre script, pas de souci)

5. **COPIE L'URL** du Web App :
   ```
   https://script.google.com/macros/s/XXXXXXXXXXXXXXXXXXXXXXXX/exec
   ```

---

## 📝 Étape 4 : Configurer l'App

1. Ouvre `src/services/ActivationLogger.js`

2. Remplace cette ligne :
   ```javascript
   const GOOGLE_SCRIPT_URL = 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';
   ```
   
   Par ton URL :
   ```javascript
   const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/XXXXXXX/exec';
   ```

3. Sauvegarde

---

## 📝 Étape 5 : Utiliser dans l'App

Dans ton code d'activation (par exemple `ActivationBlock.jsx`), ajoute :

```javascript
import { ActivationLogger } from '../services/ActivationLogger';

// Quand l'utilisateur active premium :
const handleActivation = async (code) => {
  // Log l'attempt
  await ActivationLogger.logAttempt(code);
  
  try {
    // Ta logique de validation...
    const isValid = await validateCode(code);
    
    if (isValid) {
      // Log le succès
      await ActivationLogger.logSuccess(code);
      // Continue...
    } else {
      // Log l'erreur
      await ActivationLogger.logError(code, 'Invalid code');
    }
  } catch (error) {
    await ActivationLogger.logError(code, error.message);
  }
};
```

---

## 📊 Ce que tu verras dans ton Sheet :

| Timestamp | MAC | Device Key | UUID | Code | Status | Platform | Model |
|-----------|-----|------------|------|------|--------|----------|-------|
| 2026-01-24T10:30:00 | 02:4A:8B:C3:D1:E7 | 123456 | abc123 | NINJA-PRO-001 | activated | android | SM-S928B |
| 2026-01-24T11:45:00 | 02:5B:9C:D4:E2:F8 | 789012 | def456 | NINJA-PRO-001 | activated | android | Pixel 9 |
| 2026-01-24T12:00:00 | 02:6C:AD:E5:F3:G9 | 345678 | ghi789 | NINJA-PRO-002 | activated | android | Galaxy A54 |

---

## 🚨 Détection de Piratage :

### Code partagé = Plusieurs MAC pour le même code

Utilise un filtre dans Google Sheets :
1. Sélectionne la colonne "Activation Code"
2. Data → Create a filter
3. Filtre par code pour voir combien de MAC différents

**Exemple de piratage :**
| Code | MAC Count |
|------|-----------|
| NINJA-PRO-001 | 2 ⚠️ |
| NINJA-PRO-002 | 1 ✅ |
| NINJA-PRO-003 | 47 🚫 PIRATE! |

---

## 🔒 Sécurité :

- Seul TOI peux voir les données (c'est TON Google Sheet)
- L'URL du script est obscure (impossible à deviner)
- Les données sont chiffrées en transit (HTTPS)
- Tu peux révoquer l'accès à tout moment

---

## ❓ FAQ :

**Q: Est-ce que ça ralentit l'app ?**
A: Non, l'envoi est asynchrone (en arrière-plan)

**Q: Que se passe-t-il si l'envoi échoue ?**
A: L'app continue normalement, rien n'est bloqué

**Q: Puis-je ajouter d'autres colonnes ?**
A: Oui ! Modifie le script et `ActivationLogger.js`

**Q: Combien de lignes max ?**
A: Google Sheets supporte 10 millions de cellules

---

## ✅ Checklist finale :

- [ ] Google Sheet créé avec les en-têtes
- [ ] Apps Script créé et configuré
- [ ] Script déployé comme Web App
- [ ] URL copiée dans `ActivationLogger.js`
- [ ] Test d'activation effectué
- [ ] Données visibles dans le Sheet

---

🎉 **C'est tout ! Tu as maintenant un système anti-piratage gratuit !**
