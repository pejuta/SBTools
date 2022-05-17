// ==UserScript==
// @name        SBAddUserTimelines
// @namespace   https://twitter.com/11powder
// @description Stella Boardのチャットに任意のタイムラインを追加する
// @include     /^http:\/\/stella2\.428\.st\/?(?:\?mode=(?:chat|cdel)(?:&.*)?|index.php)?$/
// @include     /^http:\/\/stella2\.428\.st\/?\?mode=profile&eno=\d+$/
// @version     1.0.12
// @updateURL   https://pejuta.github.io/SGTools/UserScripts/SBAddUserTimelines.user.js
// @downloadURL https://pejuta.github.io/SGTools/UserScripts/SBAddUserTimelines.user.js
// @grant       none
// ==/UserScript==


(async function() {
    'use strict';

    const DB_NAME = "SBToolsTools_AddUserTimelines";
    const DB_TABLE_NAME_PLAYER = "targets";
    const DB_TABLE_NAME_WORD = "searches";
    const DB_VERSION = 2;

    const escapeHtml = (() => {
        const escapeMap = Object.freeze({
           "&": "&amp;",
            "'": "&#x27;",
            "\"": "&quot;",
            "`": "&#x60;",
            "<": "&lt;",
            ">": "&gt;",
        });

        const reEscape = new RegExp(`[${Object.keys(escapeMap).join("")}]`, "g");

        return function escapeHtml(str) {
            return str.replace(reEscape, (match) => escapeMap[match]);
        };
    })();

    class SearchQuery {
        constructor(mode, list, keyword, rootid) {
            this.mode = mode;
            this.list = list;
            this.keyword = keyword;
            this.rootid = rootid;
        }

        toString() {
            return `mode=${this.mode}&list=${this.list}&keyword=${encodeURIComponent(this.keyword)}&rootid=${this.rootid}`;
        }

        static parse(query) {
            const re = /mode=([^&]*)&list=([^&]*)&keyword=([^&]*)&rootid=([^&]*)/;
            const m = re.exec(query);
            if (!m) {
                return null;
            }
            return new SearchQuery(m[1], m[2], decodeURIComponent(m[3]), m[4], decodeURIComponent(m[5]), m[6]);
        }
    }

    function openDB() {
        return new Promise((res, rej) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = (e) => {
                rej("failed to open db");
            };
            request.onsuccess = (e) => {
                res(e.target.result);
            };
            request.onblocked = (e) => {
                rej("cannot to open db; blocked.");
            };

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                const tx = e.target.transaction;

                if (!e.oldVersion) {
                    db.createObjectStore(DB_TABLE_NAME_PLAYER, { keyPath: "eno" });
                }
                if (e.oldVersion < 2) {
                    // 5列unique indexは効率が極めて悪いので文字列化して投入することにした。
                    const wordTable = db.createObjectStore(DB_TABLE_NAME_WORD, { keyPath: "id", autoIncrement: true });
                    wordTable.createIndex("query", "query", { unique: true });
                }
            };
        });
    }

    function dbGetAll(db, tableName) {
        return new Promise((res, rej) => {
            const table = db.transaction([tableName]).objectStore(tableName);
            const request = table.getAll();
            request.onerror = (e) => {
                rej("failed to getAll from table");
            };
            request.onsuccess = (e) => {
                res(e.target.result);
            };
        });
    }

    function dbGetAllKeys(db, tableName) {
        return new Promise((res, rej) => {
            const table = db.transaction([tableName]).objectStore(tableName);
            const request = table.getAllKeys();
            request.onerror = (e) => {
                rej("failed to getAllKeys from table");
            };
            request.onsuccess = (e) => {
                res(e.target.result);
            };
        });
    }

    function dbPut(db, tableName, item) {
        return new Promise((res, rej) => {
            const table = db.transaction([tableName], "readwrite").objectStore(tableName);
            const request = table.put(item);
            request.onerror = (e) => {
                rej("failed to put an item on table");
            };
            request.onsuccess = (e) => {
                res(e.target.result);
            };
        });
    }

    function dbDelete(db, tableName, key) {
        return new Promise((res, rej) => {
            const table = db.transaction([tableName], "readwrite").objectStore(tableName);
            const request = table.delete(key);
            request.onerror = (e) => {
                rej("failed to delete an item on table");
            };
            request.onsuccess = (e) => {
                res(e.target.result);
            };
        });
    }

    const _vDoc = document.implementation.createHTMLDocument();
    async function fetchCharaInfo(eno) {
        const url = `http://stella2.428.st/?mode=profile&eno=${eno}`;
        const req = await fetch(url);
        if (!req.ok) {
            return null;
        }
        const html = await req.text();

        return extractInfoFromProfile($(html, _vDoc));
    }
    // 優先度はNickname > Fullname
    async function extractInfoFromProfile($doc) {
        const $firstIcon = $doc.find(".cdatal:eq(2) > table").find("img:first");

        const icon = $firstIcon.attr("src");

        const $profile = $doc.find(".profile > .inner_boardclip");
        if ($profile.length === 1) {
            const id = $profile.contents().eq(0).text().trim();
            const fullname = id.substr(id.indexOf("　") + 1);
            return { icon, name: fullname };
        }

        return null;
    }

    function extractEnoFromTitle() {
        const m = /^ENo\.(\d+)/i.exec(document.title);
        if (!m) {
            return 0;
        }
        return parseInt(m[1], 10);
    }

    async function inputThenAddNewUserTimelineButton(db) {
        const userTxt = prompt("対象キャラクターのENo.を入力してください。タイムラインを新規追加します。");
        const m = /\d+/.exec(userTxt);
        if (!m) {
            return;
        }
        const eno = parseInt(m[0], 10);
        const info = await fetchCharaInfo(eno);
        if (!info) {
            alert("ダウンロードに失敗したか、キャラが存在しないようです。");
            return;
        }
        const newTarget = { eno, name: info.name, icon: info.icon };
        await dbPut(db, DB_TABLE_NAME_PLAYER, newTarget);
        appendUserTimelineButton(newTarget);
    }

    async function confirmThenRemoveUserTimeline(db, $rmvButton) {
        const $targetElem = $rmvButton.prev();
        const targetId = $targetElem.children("img").attr("title") || $targetElem.html();
        const res = confirm(`ユーザータイムライン[ ${targetId} ]を削除します。`);
        if (!res) {
            return;
        }
        const eno = $rmvButton.data("eno");
        removeUserTimelineButton(eno);
        await dbDelete(db, DB_TABLE_NAME_PLAYER, eno);
    }

    function appendUserTimelineButton(target) {
        let arr;
        if (Array.isArray(target)) {
            arr = target;
        } else {
            arr = [target];
        }

        const descendingTargets = arr.slice();
        descendingTargets.sort((a, b) => b.eno - a.eno);

        const $lastRoom = $("a > .roomname").last().parent();

        // eno降順に末尾に追加するので結果的に昇順になる
        descendingTargets.forEach((target) => {
            let html;
            if (target.icon) {
                html = ` <a href="./?mode=chat&list=5&chara=${target.eno}" id="roome${target.eno}" class="roomlink usertl iconlabel"><span class="roomname"><img src="${target.icon}" title="${escapeHtml(target.name)}(${target.eno})"></span><i class="removetlbutton" data-eno="${target.eno}"></i></a>`;
            } else {
                html = ` <a href="./?mode=chat&list=5&chara=${target.eno}" id="roome${target.eno}" class="roomlink usertl"><span class="roomname">${escapeHtml(target.name)}(${target.eno})</span><i class="removetlbutton" data-eno="${target.eno}"></i></a>`;
            }
            // TODO: appendTo
            $lastRoom.after(html);
        });
    }
    function removeUserTimelineButton(eno) {
        $(`#roome${eno}`).remove();
    }

    async function addNewSearchTimelineButton(db) {
        const $form = $(".mainarea > .sheet:first form");
        const mode = $form.children("[name='mode']:first").val() || "";
        const list = $form.children("[name='list']:first").val() || "";
        const keyword = $form.children("[name='keyword']:first").val() || "";

        let rootid = "";
        const $logSavingModeButton = $(".roomnameplace");
        if (list === "3" && $logSavingModeButton.length === 1) {
            const m = /&rootid=(\d+)/.exec($logSavingModeButton.parent("a").attr("href"));
            rootid = m ? m[1] : "";
        }
        const query = new SearchQuery(mode, list, keyword, rootid);

        let id = 0;
        try {
            id = await dbPut(db, DB_TABLE_NAME_WORD, { query: query.toString() });
        } catch (e) {
            // 重複。
            return;
        }
        appendSearchTimelineButton({ id, query });
    }

    async function confirmThenRemoveSearchTimeline(db, $rmvButton) {
        const $targetElem = $rmvButton.prev();
        const targetText = $targetElem.text();
        const res = confirm(`検索タイムライン[ ${targetText} ]を削除します。`);
        if (!res) {
            return;
        }
        const id = $rmvButton.data("id");
        removeSearchTimelineButton(id);
        await dbDelete(db, DB_TABLE_NAME_WORD, id);
    }

    function appendSearchTimelineButton(target) {
        let arr;
        if (Array.isArray(target)) {
            arr = target;
        } else {
            arr = [target];
        }

        const descendingTargets = arr.slice();
        descendingTargets.sort((a, b) => b.id - a.id);

        const $lastRoom = $("a > .roomname").last().parent();

        // eno降順に末尾に追加するので結果的に昇順になる
        descendingTargets.forEach((t) => {
            let query;
            if (typeof t.query === "string") {
                query = SearchQuery.parse(t.query);
            } else {
                query = t.query
            }

            let listText;
            switch(query.list) {
                case "0": // all
                    listText = "全体";
                    break;
                case "1": // tl
                    listText = "タイムライン";
                    break;
                case "2": // res
                    listText = "返信";
                    break;
                case "3": // tree
                    listText = "発言ツリー" + query.rootid;
                    break;
                case "4": // self
                    listText = "自分";
                    break;
                case "5": // user
                    listText = "ユーザー";
                    break;
                case "6": // room
                    listText = "周辺：" + query.room;
                    break;
                case "7": // message
                    listText = "メッセージ";
                    break;
                case "8": // list
                    listText = "リスト";
                    break;
            }

            const labelHtmls = `<div class="wsroom">at:${escapeHtml(listText)}</div> <div class="wsquery">${query.filtereno ? `from:${query.filtereno} ` : ""}${escapeHtml(query.keyword)}</div>`;
            const html = ` <a href="./?${query.toString()}" id="roomws${t.id}" class="roomlink wstl"><i class="searchicon"></i><span class="roomname">${labelHtmls}</span><i class="removetlbutton" data-id="${t.id}"></i></a>`;
            // TODO: appendTo
            $lastRoom.after(html);
        });
    }
    function removeSearchTimelineButton(id) {
        $(`#roomws${id}`).remove();
    }

    function $appendAddNewUserTimelineButton() {
        const $lastRoom = $("a > .roomname").last().parent();
        const html = ` <a href="#" onclick="return false;"><span class="addnewusertl">＋TL</span></a>`;
        $lastRoom.after(html);
        return $(".addnewusertl");
    }

    function $insertAddNewSearchButton() {
        const $submit = $("table.talklist_main + div > form input[type='submit']").first();
        const html = `<a href="#" onclick="return false;"><span class="addnewsearchtl">＋TL</span></a>`;
        $submit.after(html);
        return $(".addnewsearchtl");
    }

    async function initButtons(db) {
        const users = await dbGetAll(db, DB_TABLE_NAME_PLAYER);
        appendUserTimelineButton(users);
        const $addUserButton = $appendAddNewUserTimelineButton();
        $addUserButton.on("click", async (e) => await inputThenAddNewUserTimelineButton(db));
        $(document).on("click", ".usertl > .removetlbutton", async function (e) {
            e.preventDefault();
            await confirmThenRemoveUserTimeline(db, $(this));
        });

        const wordSearches = await dbGetAll(db, DB_TABLE_NAME_WORD);
        appendSearchTimelineButton(wordSearches);
        const $addSearchButton = $insertAddNewSearchButton();
        $addSearchButton.on("click", async (e) => await addNewSearchTimelineButton(db));
        $(document).on("click", ".wstl > .removetlbutton", async function (e) {
            e.preventDefault();
            await confirmThenRemoveSearchTimeline(db, $(this));
        });
    }

    async function updateTargetDataOfCurrentPage(db) {
        const eno = extractEnoFromTitle();
        if (eno === 0) {
            return;
        }
        const targetEnos = await dbGetAllKeys(db, DB_TABLE_NAME_PLAYER);
        if (targetEnos.indexOf(eno) !== -1) {
            const info = await extractInfoFromProfile($(document));
            await dbPut(db, DB_TABLE_NAME_PLAYER, { eno, name: info.name, icon: info.icon });
        }
    }

    let currentPage = "";
    if ($("#btnreplylist").length === 1) {
        // chat
        currentPage = "chat";
    } else if ($(".profile").length === 1) {
        // profile
        currentPage = "profile";
    } else {
        return;
    }

    const database = await openDB();
    if (currentPage === "chat") {
        await initButtons(database);
        $(document.head).append(`<style type="text/css">
.roomlink {
    position: relative;
    display: inline-block;
    vertical-align: top;
}
.addnewusertl, .addnewsearchtl  {
    display: inline-block;
    padding: 5px;
    padding-left: 16px;
    padding-right: 16px;
    border: 1px #999999 solid;
    border-radius: 2px;
    background-color: #5577cc;
    box-shadow: 0px 2px 2px rgba(0, 10, 20, 0.8);
    color: #ffffff;
    font-weight: bold;
    cursor: pointer;
}
.addnewsearchtl {
    margin-left:4px;
}
.addnewusertl:hover, .addnewsearchtl:hover {
    background-color: #e0dd90;
}
.removetlbutton:after {
    content: "✕";
    display: inline-block;
    width: 0.8em;
    height: 0.8em;
    position: absolute;
    right: 8px;
    line-height: 100%;
    color: #bbccf9;
    border: solid 1px #8899ee;
    background-color: #1f1f39;
}
.usertl > .roomname {
    background-color: rgba(90,90,150, 0.2);
}
.wstl > .roomname {
    border-left: 12px solid #007777;
    min-width: auto;
    padding: 1px 1.1em 0 8px;
}
.wsroom {

}
.wsquery {
    min-height: 1.5em;
}
.roomname{
    margin-bottom: 4px;
}
.iconlabel .roomname{
    padding: 0;
    padding-left: 0;
    padding-right: 0;
    min-width: auto;
}
.iconlabel img {
    width: calc(1.5em + 16px);
    height: calc(1.5em + 16px);
}
.searchicon:before {
    content: "\\01F50E";
    display: inline-block;
    font-family: "Segoe UI Symbol";
    position: absolute;
    color: #bbccf9;
}
</style>`);
    } else if (currentPage === "profile") {
        updateTargetDataOfCurrentPage(database);
    }
})();
