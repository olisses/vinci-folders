import { rootFolder } from './folders.js';

export async function loadGoogleApis(resolve, reject) {
    return new Promise((resolve, reject) => {
        let gapiScript = document.createElement('script');
        gapiScript.src = 'https://apis.google.com/js/api.js';
        gapiScript.onload = () => gapiLoaded(resolve, reject);
        gapiScript.onerror = () => reject(new Error(`Script load error for ${gapiScript.src}`));
        document.body.appendChild(gapiScript);

        let gisScript = document.createElement('script');
        gisScript.src = 'https://accounts.google.com/gsi/client';
        gisScript.onload = () => gisLoaded(resolve, reject);
        gisScript.onerror = () => reject(new Error(`Script load error for ${gisScript.src}`));
        document.body.appendChild(gisScript);
    });
}

// TODO(developer): Set to client ID and API key from the Developer Console
const CLIENT_ID = '554018191636-50jdp9nm8vmasq89qkjk9nlpabom5f88.apps.googleusercontent.com';
const API_KEY = 'AIzaSyAPqkyBl3vfnsKHB-Gv9sEdYxUycA_WfJU';

// Discovery doc URL for APIs used by the quickstart
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
const SCOPES = 'https://www.googleapis.com/auth/drive';

let tokenClient;
let gapiInited = false;
let gisInited = false;

/**
 * Callback after api.js is loaded.
 */
function gapiLoaded(resolve, reject) {
    gapi.load('client', () => {
        intializeGapiClient(resolve, reject);
    });
}

/**
 * Callback after the API client is loaded. Loads the
 * discovery doc to initialize the API.
 */
async function intializeGapiClient(resolve, reject) {
    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
    });
    gapiInited = true;
    maybeEnableButtons(resolve, reject);
}

/**
 * Callback after Google Identity Services are loaded.
 */
function gisLoaded(resolve, reject) {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        // prompt: 'select_account',
        // prompt: '',
        callback: '', // defined at request time
    });
    gisInited = true;
    maybeEnableButtons(resolve, reject);
}

/**
 * Enables user interaction after all libraries are loaded.
 */
function maybeEnableButtons(resolve, reject) {
    if (gapiInited && gisInited) {
        resolve();
    }
}

let TOKEN;
/**
 *  Sign in the user upon button click.
 */
export async function login() {
    return new Promise((resolve, reject) => {
        tokenClient.callback = async (resp) => {
            if (resp.error !== undefined) {
                reject(resp.error);
                return;
            }

            // GIS has automatically updated gapi.client with the newly issued access token.
            console.log('gapi.client access token:');
            TOKEN = gapi.client.getToken()
            console.log(TOKEN);
            localStorage.setItem('token', JSON.stringify(TOKEN));

            resolve();
        };

        // let token = { 
        //     access_token: 'ya29.a0ARrdaM-Gk8rHdnX6Nxf_uku6dOjRBKzUblUn11RgABu…1ePG682J1wWjziX_t2KJObcI79G9_ps9YAToMtaFnxzCzCU0Q', 
        //     token_type: 'Bearer', 
        //     expires_in: 3598, 
        //     scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.metadata.readonly' 
        // };

        // let strToken = localStorage.getItem('token');
        // if (strToken != null) {
        //     TOKEN = JSON.parse(strToken);
        //     gapi.client.setToken(TOKEN);
        //     resolve();
        //     return;
        // }

        if (gapi.client.getToken() === null) {
            // Prompt the user to select a Google Account and ask for consent to share their data
            // when establishing a new session.
            // tokenClient.requestAccessToken({ prompt: 'consent' });
            tokenClient.requestAccessToken();
        } else {
            // Skip display of account chooser and consent dialog for an existing session.
            tokenClient.requestAccessToken();
        }
    });
}

/**
 *  Sign out the user upon button click.
 */
export function logout() {
    gapi.client.setToken('');
    localStorage.removeItem('token');
    TOKEN = null;
}

let VINCI_FOLDER_ID;
async function getVinciFolderId() {
    if (VINCI_FOLDER_ID != null) return VINCI_FOLDER_ID;

    let response;
    try {
        response = await gapi.client.drive.files.list({
            q: `name='vinci-folders' and trashed=false`,
            fields: 'files(id, name, mimeType)',
            spaces: 'drive'
        });
    } catch (err) {
        if (err.result?.error?.message === 'Invalid Credentials') {
            localStorage.removeItem('token');
        }
        throw new Error(`Error loading files: ${err.message ?? err}`);
    }
    if (response.result.files.length > 0) {
        VINCI_FOLDER_ID = response.result.files[0].id;
    } else {
        VINCI_FOLDER_ID = createFolder(null, 'vinci-folders');
    }
    return VINCI_FOLDER_ID;
}

/**
 * Print metadata for first 10 files.
 */
export async function listFilesInFolder(folderId) {
    if (folderId == null) {
        folderId = await getVinciFolderId();
    }

    let response;
    try {
        response = await gapi.client.drive.files.list({
            q: `'${folderId}' in parents and trashed=false`,
            pageSize: 30,
            fields: 'nextPageToken, files(id, name, mimeType, webContentLink)',
            spaces: 'drive'
        });
    } catch (err) {
        throw new Error(`Error loading files: ${err.message ?? err}`);
    }
    const files = response.result.files;
    console.log(files);
    return files;
}

function getFoldersFromPath(path) {
    if (path.startsWith('/')) path = path.slice(1);
    if (path.endsWith('/')) path = path.slice(0, -1);

    let folders = path.split('/');
    if (folders[0] === '') folders = [];

    return folders;
}

async function getFolderId(path) {
    let folders = getFoldersFromPath(path);

    let parentId = await getVinciFolderId();
    for (let folderInPath of folders) {
        // console.log('buscando os arquivos no folder id: ' + parentId);
        let filesInDrive = await listFilesInFolder(parentId);
        let found = false;
        for (let fileInDrive of filesInDrive) {
            if (fileInDrive.mimeType !== 'application/vnd.google-apps.folder') continue;
            if (fileInDrive.name !== folderInPath) continue;
            parentId = fileInDrive.id;
            found = true;
            console.log('parentId: ' + parentId);
            break;
        }
        if (!found) throw 'Path does not exist!';
    }
    return parentId;
}

export async function listFilesInPath(path) {
    let folderId = await getFolderId(path);

    let folders = getFoldersFromPath(path);

    let filesInPath = await listFilesInFolder(folderId);
    filesInPath = filesInPath.map(file => {
        let path = '';
        if (folders.length > 0) {
            path = '/' + folders.join('/');
        }
        path += '/' + file.name;
        let type = file.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file';
        return {
            name: file.name,
            path: path,
            type: type,
            id: file.id
        };
    });
    return filesInPath;
}

export async function createVinciFolders(msn, matricula) {
    let vinciFolderId = await getVinciFolderId();
    const msnId = await createFolder(vinciFolderId, msn);
    const matriculaId = await createFolder(msnId, matricula);
    await createFoldersInDrive(msn, matricula, matriculaId, rootFolder.childreen);
}

async function createFoldersInDrive(msn, matricula, driveParentId, childreen) {
    let promises = [];
    for (const child of childreen) {
        const localName = child.name;
        const driveName = localName.replace('MSN', msn).replace('MATRICULA', matricula);

        const driveId = await createFolder(driveParentId, driveName);

        let promise = createFoldersInDrive(msn, matricula, driveId, child.childreen);
        promises.push(promise);
    }
    await Promise.all(promises);
}

/**
 * Cria uma pasta, dentro de outra pasta
 * @param {string} parentId id da pasta pai
 * @param {string} folderName nome da pasta a ser criada
 * @returns {Promise} promise que resolve com o id da pasta criada
 */
async function createFolder(parentId, folderName) {
    var fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
    };

    if (parentId != null) {
        fileMetadata.parents = [parentId];
    }

    let ret = await gapi.client.drive.files.create({
        resource: fileMetadata,
        fields: 'id'
    });

    return ret.result.id;
}

export async function uploadToFolderOld(parentId) {
    if (parentId == null) {
        parentId = await getVinciFolderId();
    }

    const fileMetadata = {
        'title': 'file1.txt',
        // parents: [{ id: parentId }],
    };
    const media = {
        mimeType: 'text/plain',
        body: 'Eu sou o conteudo',
    };

    try {
        const ret = await gapi.client.drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id',
            uploadType: 'multipart'
        });
        console.log('File Id:', ret.result.id);
        return ret.result.id;
    } catch (err) {
        // TODO(developer) - Handle error
        throw err;
    }
}

export async function uploadToPath(file, path) {
    let folderId = await getFolderId(path);
    return await uploadToFolderId(file, folderId);
}

async function getBase64Content(file) {
    return new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onload = () => {
            let content = btoa(reader.result);
            resolve(content);
        }
        reader.onerror = () => {
            reject(reader.error);
        }
        reader.readAsBinaryString(file);
    });
}

async function uploadToFolderId(file, folderId) {
    if (folderId == null) {
        folderId = VINCI_FOLDER_ID;
    }

    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    let metadata = {
        name: file.name,
        mimeType: file.type,
        parents: [folderId]
    };

    let base64Content = await getBase64Content(file);

    let multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: ' + file.type + '\r\n' +
        'Content-Transfer-Encoding: base64\r\n' +
        '\r\n' +
        base64Content +
        close_delim;

    let response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST',
        headers: {
            'Content-Type': 'multipart/related; boundary=' + boundary,
            'Content-Length': multipartRequestBody.length,
            'authorization': 'Bearer ' + TOKEN.access_token,
        },
        body: multipartRequestBody
    });

    let resp = await response.json();
    //   console.log(resp);
    return resp.id;
}

export async function downloadFile(id) {
    let response = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
        headers: {
            'authorization': 'Bearer ' + TOKEN.access_token
        }
    });

    const blob = await response.blob();

    return blob;
}
