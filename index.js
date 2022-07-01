import  * as drive from './drive.js';

let folderId = null;

async function update() {
    let path = getPath();
    updatePath(path);
    updateFiles(path);
}

function getPath() {
    let path = window.location.hash;
    if (!path.startsWith('#/')) {
        path = '#/' + path;
    }
    path = path.slice(1);
    return path;
}

async function updatePath(path) {
    let folders = path.split('/');
    folders.shift();
    // <a href="#/">vinci-folders</a> / <a href="#/123">123</a> / <a href="#/123/456789">456789</a>
    let href = '#';
    let html = `/ <a href="${href}">vinci-folders</a>`;
    for (let folder of folders) {
        if (folder === '') break;
        href += `/${folder}`;
        html += ` / <a href="${href}">${folder}</a>`
    }
    document.querySelector('#path').innerHTML = html;
    console.log('html: ' + html);
}

async function createFolder() {
    let respDiv = document.querySelector('#createFoldersResponse');
    respDiv.innerHTML = 'Gerando Pastas...';
    
    let msn = document.querySelector('#msn').value;
    let matricula =  document.querySelector('#matricula').value;

    await drive.createVinciFolders(msn, matricula);
    respDiv.innerHTML = 'Pastas geradas!';

    update();
}

async function init() {
    try {
        await drive.loadGoogleApis();
    } catch (err) {
        console.log('Problema carregando as APIS do Google: ' + err);
        throw err;
    }

    let loginBut = document.querySelector('#login');
    loginBut.disabled = false;
    loginBut.onclick = login;

    let logoutBut = document.querySelector('#logout');
    logoutBut.onclick = logout;

    let createFoldersBut = document.querySelector('#createFolders');
    createFoldersBut.onclick = showNewFolders;

    let createFoldersBut2 = document.querySelector('#createFolders2');
    createFoldersBut2.onclick = createFolder;

    let voltarBut = document.querySelector('#back');
    voltarBut.onclick = showListFiles;

    let uploadFileIn = document.querySelector('#uploadFile');
    uploadFileIn.onchange = uploadFile;
}

async function login() {
    console.log('login');
    try {
        await drive.login();
    } catch (err) {
        console.log(err);
        return;
    }

    document.querySelector('#login').style.display = 'none';
    document.querySelector('#menu-botoes').style.display = 'inline-block';
    
    showListFiles();

    window.addEventListener('popstate', update);

    update();
}

async function logout() {
    drive.logout();
    document.querySelector('#login').style.display = 'inline-block';
    document.querySelector('#menu-botoes').style.display = 'none';
    document.querySelector('#list-files').style.display = 'none';
}

async function updateFiles(path) {
    
    let files = await drive.listFilesInPath(path);
    files.sort((e1, e2) => {
        if (e1.type === e2.type) {
            if (e1 === e2) return 0;
            if (e1 > e2) return 1;
            return -1; 
        }
        if (e1.type === 'folder' && e2.type !== 'folder') {
            return -1;
        }
        if (e1.type !== 'folder' && e2.type === 'folder') {
            return 1;
        }
    });
    let html = ``;
    for (let file of files) {
        if (file.type === 'folder') {
            html += `<div><a href="#${file.path}">[${file.name}]</a></div>`;
        } else {
            html += `<div><a class="downloadFile" download="${file.name}" fileId="${file.id}" href="#">${file.name}</a></div>`;
        }
    }
    document.querySelector('#files').innerHTML = html;

    let downloadFileLinks = document.querySelectorAll('.downloadFile');
    downloadFileLinks.forEach((downloadFileLink) => {
        downloadFileLink.onclick = downloadFile;
    });
}

async function uploadFile(event) {
    let msg = document.querySelector('#uploadMessage');
    msg.textContent = 'Enviando arquivo...';
    console.log(event);
    let file = event?.srcElement?.files[0];
    if (file == null) return;
    let path = getPath();
    await drive.uploadToPath(file, path);
    msg.textContent = '';
    update();
}

async function downloadFile(event) {
    event.preventDefault();
    let link = event.srcElement;
    let id = event.srcElement.getAttribute("fileId");
    let blob = await drive.downloadFile(id);
    // let newBlob = new Blob([blob]);
    let downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = link.download;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(downloadLink.href);
}

function showListFiles() {
    document.querySelector('#createFolders').style.display = 'inline';
    document.querySelector('#back').style.display = 'none';
    document.querySelector('#list-files').style.display = 'block';
    document.querySelector('#new-folders').style.display = 'none';
}

function showNewFolders() {
    document.querySelector('#createFolders').style.display = 'none';
    document.querySelector('#back').style.display = 'inline';
    document.querySelector('#list-files').style.display = 'none';
    document.querySelector('#new-folders').style.display = 'block';
}

init();
