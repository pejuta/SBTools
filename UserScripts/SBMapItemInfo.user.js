// ==UserScript==
// @name        SBMapItemInfo
// @namespace   https://twitter.com/11powder
// @description Stella Boardの各種行動画面にアイテム情報を表示する。
// @include     /^http:\/\/stella2\.428\.st\/?(?:\?mode=action)?$/
// @version     1.0.2.1
// @updateURL   https://pejuta.github.io/SBTools/UserScripts/SBMapItemInfo.user.js
// @downloadURL https://pejuta.github.io/SBTools/UserScripts/SBMapItemInfo.user.js
// @grant       none
// ==/UserScript==

await (async () => {
    const $targetSubtitle = $("h2.subtitle").filter((i, e) => e.innerHTML === "マップ移動");
    if ($targetSubtitle.length === 0) {
        return;
    }

    function delay(ms) {
        return new Promise((resolve) => {
            setTimeout(() => resolve(), ms);
        });
    }

    // ロード完了時に使うことで最初に選択されている星を取得する唯一の手段となる。
    function getCurrentStnoSelected() {
        return parseInt(/^\d+/.exec($("#maptitle").html())[0], 10);
    }

    async function dlStarsInfo() {
        const res = await fetch(`https://pejuta.github.io/SBTools/Data/Json/stars.json`);
        if (!res.ok) {
            return "dlStarsInfo faileddownloading";
        }

        return await res.json();
    }

    async function dlSignsInfo() {
        const res = await fetch(`https://pejuta.github.io/SBTools/Data/Json/signs.json`);
        if (!res.ok) {
            return "dlStarsInfo faileddownloading";
        }

        return await res.json();
    }

    async function dlDropLocationData() {
        const res = await fetch(`https://dl.dropboxusercontent.com/s/l8a6jz9d35aqza6/drop.json`);
        if (!res.ok) {
            return "dlDropLocationData faileddownloading";
        }

        return await res.json();
    }

    async function dlClearedStarSet(eno) {
        const res = await fetch(`https://dl.dropboxusercontent.com/s/jt4ga191ul2362r/dropClear.json`);
        if (!res.ok) {
            return "dlClearedStarSet faileddownloading";
        }

        const starsArr = (await res.json())[eno] || [];
        return new Set(starsArr);
    }

    function readSelfEno() {
        return $(".charaframeself").data("eno");
    }

    async function dlFragmentsDropInfo() {
        const res = await fetch(`https://dl.dropboxusercontent.com/s/ir670qikmqpbjtv/fragment.json`);
        if (!res.ok) {
            return "dlFragmentsDropInfo faileddownloading";
        }

        return await res.json();
    }

    async function dlFragmentsToSigns() {
        const res = await fetch(`https://dl.dropboxusercontent.com/s/48lytkxkszuurii/resolution.json`);
        if (!res.ok) {
            return "dlFragmentsToSigns faileddownloading";
        }

        return await res.json();
    }

    function getUAP() {
        const $uap = $("h2.subtitle").filter((i, e) => e.innerHTML === "マップ移動").next("p").children("b").eq(2);
        const m = /\d+$/.exec($uap.html());
        if (!m) {
            return -1;
        }
        return parseInt(m[0], 10);
    }

    function observeMap(moCallback) {
        const targetNode = document.getElementById("maparea");
        const moConfig = { childList: true };

        const mo = new MutationObserver(moCallback);
        mo.observe(targetNode, moConfig);
        return mo;
    }

    function includeItemInfoOnMap(locationToItem, clearedStars) {
        for (let starNum in locationToItem) {
            const $star = $("#stno" + starNum);
            $star.data("miiitem", locationToItem[starNum]);

            if (clearedStars.has(parseInt(starNum, 10))) {
                $star.addClass("stcleared");
            }
        }
    }

    function appendItemIcon(locationToItem, clearedStars) {
        for (let starNum in locationToItem) {
            if (clearedStars.has(parseInt(starNum, 10))) {
                continue;
            }

            const itemName = locationToItem[starNum];
            let className = "miimsc";
            if (itemName.startsWith("★") && !itemName.endsWith("』")) {
                // eqpt
                className = "miieqp";
            } else if (itemName.startsWith("★") || itemName.startsWith("◆")) {
                // orb
                className = "miiorb";
            } else if (itemName.endsWith("のカード")) {
                // card
                className = "miicrd";
            }

            $("#stno" + starNum).append(`<span class="miic ${className}"/>`);
        }
    }

    const _$tooltip = $("<div class='mapiteminfo'><span class='miival'></span></div>");
    function showTooltip(targetStarNode) {
        if ($("#maparea").hasClass("allitemshown")) {
            return;
        }
        const itemName = $(targetStarNode).data("miiitem");
        if (!itemName) {
            return;
        }
        _$tooltip.children(".miival").html(itemName);
        $(targetStarNode).append(_$tooltip);
    }
    function hideTooltip() {
        if ($("#maparea").hasClass("allitemshown")) {
            return;
        }
        _$tooltip.remove();
    }

    function toggleTooltipsForAll(clearedStars) {
        if ($("#maparea").hasClass("allitemshown")) {
            $("#maparea").find(".mapiteminfo").remove();
            $("#maparea").removeClass("allitemshown")
            return;
        }
        _$tooltip.remove();

        $("#maparea > .layout[id^=stno]").each((i, e) => {
            const itemName = $(e).data("miiitem");
            if (!itemName) {
                return;
            }
            const $tooltip = _$tooltip.clone().children(".miival").html(itemName).end();
            $(e).append($tooltip);
        });

        $("#maparea").addClass("allitemshown");
    }

    function addToggleTooltipsButton(clearedStars) {
        const $button = $("<span id='togglemapitems' class='sbbutton'>アイテム情報の全表示/非表示</span>").on("click", (e) => {
            toggleTooltipsForAll(clearedStars);
        });

        $("#maparea + p").prepend($button);
    }

    function updateMapOnMutation(locationToItem, clearedStars) {
        observeMap(() => {
            includeItemInfoOnMap(locationToItem, clearedStars);
            appendItemIcon(locationToItem, clearedStars);
            if ($("#maparea").hasClass("allitemshown")) {
                $("#maparea").removeClass("allitemshown");
                toggleTooltipsForAll(clearedStars);
            }
        });
    }

    function observeMapTitle(moCallback) {
        const targetNode = document.getElementById("maptitle");
        const moConfig = { childList: true };

        const mo = new MutationObserver(moCallback);
        mo.observe(targetNode, moConfig);
        return mo;
    }

    function addFragmentInfoTableOnMap(stars, fragDrops, currentStno) {
        const $table = $(`<table class="fragsdroptable"><thead><tr><th>かけら予測</th></tr></thead><tbody/></table>`);
        const $cnt = $(`<div class="fragsdropmap"/>`).append($table);

        function update(stnoSelected) {
            const seizano = stars[stnoSelected].seizano;
            const uap = getUAP();
            console.log("UAP: ", uap);
            if (uap === -1) {
                return;
            }

            const frags = fragDrops[Math.floor(uap / 10) + seizano * 2];
            if (!frags) {
                return;
            }
            const tdHtml = "<tr><td>" + frags.join("</td></tr><tr><td>") + "</td></tr>";
            $table.find("tbody").html(tdHtml);

            const stName = stars[stnoSelected].stname;
            $table.find("th").html(stName).attr("title", stName);
        }

        observeMapTitle((e) => {
            const stno = getCurrentStnoSelected();
            update(stno);
        });

        update(currentStno);
        $cnt.insertBefore("#maparea");
    }

    function observeInputMaproute(moCallback) {
        const targetNode = document.getElementById("inputmaproot");
        const moConfig = { attributes: true };

        const mo = new MutationObserver(moCallback);
        mo.observe(targetNode, moConfig);
        return mo;
    }

    function addFragmentInfoTableOnMove(stars, fragDrops, currentStno) {
        const $table = $(`<table class="fragsdroptable"><thead><tr><th>かけら予測</th></tr></thead><tbody/></table>`);
        const $cnt = $(`<div class="fragsdropmove"/>`).append($table);
        const $savePointSelect = $("select[name='savepoint']");

        function update() {
            const route = $("#inputmaproot").val();
            const isUsingDie = $("#usetype").text() === "ダイス目";
            const savePointSelected = parseInt($savePointSelect.val(), 10);

            let targetStno;
            if (isUsingDie) {
                const splt = route.split(",");
                targetStno = parseInt(splt[splt.length - 1], 10);
            } else if (savePointSelected > 0) {
                targetStno = savePointSelected;
            } else {
                targetStno = currentStno;
            }

            const seizano = stars[targetStno].seizano;
            let uap = getUAP();
            if (uap === -1) {
                return;
            }
            if (isUsingDie) {
                uap++;
            }

            const frags = fragDrops[Math.floor(uap / 10) + seizano * 2];
            if (!frags) {
                $table.find("tbody").empty();
                return;
            }
            const tdHtml = "<tr><td>" + frags.join("</td></tr><tr><td>") + "</td></tr>";
            $table.find("tbody").html(tdHtml);

            const stName = stars[targetStno].stname;
            $table.find("th").html(stName).attr("title", stName);
        }

        $savePointSelect.on("change", update);
        observeInputMaproute(update);
        update();
        $cnt.insertAfter($("#d1").siblings("input[type='submit']~br").first());
    }

    function addFragmentFinder(signs, fragDrops, fragToSigns) {
        const uap = getUAP();
        const $cnt = $(`<div class="fragfinder"><div><p class="selecttargetsign">かけらを探す：<select>--</select></p><p class="selectedsign"></p><p class="possiblefrags"></p></div></div>`);
        const $select = $cnt.find("select");

        const f2sOfCurrentUAP = fragToSigns[Math.floor(uap / 10)];

        $select.html(`<option selected value="-1"></option><option>${Object.keys(f2sOfCurrentUAP).join("</option><option>")}</option>`);

        const $signsCell = $cnt.find(".selectedsign");
        const $possibleFragsCell = $cnt.find(".possiblefrags");

        $select.on("change", () => {
            $possibleFragsCell.empty();

            if ($select.val() === "-1") {
                $signsCell.empty();
                return;
            }

            const fragSelected = $select.children(":selected").html();
            $signsCell.html(`<span>${f2sOfCurrentUAP[fragSelected].join("</span><span>")}</span>`);
        })

        $signsCell.on("click", "span", function(e) {
            $(e.currentTarget).addClass("selected").removeClass("halftp").siblings().removeClass("selected").addClass("halftp");

            const signSelected = e.currentTarget.innerHTML;
            const frags = fragDrops[Math.floor(uap / 10) + signs[signSelected] * 2];
            $possibleFragsCell.html(`<span>${frags.join("</span><span>")}</span>`);
        });

        $cnt.insertAfter($("#d1").siblings("input[type='submit']~br").first());
    }



    function addNotice() {
        $("#maparea + p").after(`<p><small>※マップ上の未取得アイテムの強調アイコンは、そのアイテムの取得後すぐには消滅しません。<a href="http://gameprn.web.fc2.com/SB2" target="_blank">Libra Report</a>の更新タイミング(朝/夕方)に更新が行われます。</small></p>`);
    }

    $("head").append(
`<style type="text/css">
    #stcursor {
        pointer-events: none;
    }
    .sbbutton {
        display: inline-block;
        padding: 5px;
        padding-left: 16px;
        padding-right: 16px;
        border: 1px #999999 solid;
        border-radius: 2px;
        background-color: #5577cc;
        box-shadow: 0px 2px 2px rgb(0 10 20 / 80%);
        color: #ffffff;
        font-weight: bold;
        cursor: pointer;
    }
    #maparea + p {
        position: relative;
    }
    #togglemapitems {
        position: absolute;
        left: 0px;
    }
    .layout > .mapiteminfo {
        position: absolute;
        z-index: 2;
        pointer-events: none;
        width: 200px;
        left:0;
        right: 0;
        top:100%;
        margin-top: -4px;
        margin-left: calc(-200px / 2 + 25px);
    }

    .layout[id^=stno]:hover {
        z-index: 310;
    }

    .mapiteminfo > .miival {
        display: inline-block;
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        -webkit- transform: translateX(-50%);
        padding: 0 6px;
        background-color: rgba(7,7,15,0.8);
        border: 1px solid rgba(255,255,255,0.8);
        border-radius: 4px;
        text-align: center;
        white-space: nowrap;
    }

    .mapiteminfo:before {
        content: "";
        position: absolute;
        bottom: 100%;
        left: 50%;
        margin-left: -6px;
        border: 6px solid transparent;
        border-bottom: 8px solid rgba(255,255,255,0.8);
    }

    .stcleared .mapiteminfo > .miival {
        color: rgba(127,127,127);
        border: 1px solid rgba(127,127,127,0.8);
    }
    .stcleared .mapiteminfo:before {
        color: rgba(127,127,127);
        border-bottom: 8px solid rgba(127,127,127,0.8);
    }
    .miic:before {
        content: "";
        display: none;
        position: absolute;
        z-index: 1;
        pointer-events: none;
        top: 9px;
        right: 9px;
        width: 12px;
        height: 12px;
        font-size: 10px;
        line-height: 12px;
        text-align: center;
        color: black;
        border: rgba(7,7,15,0.8) solid 1px;
        border-radius: 6px;
    }
    .miic.miimsc:before {
        content: "+";
        display: block;
        background-color: rgb(255,79,79);
    }
    .miic.miieqp:before {
        content: "E";
        display: block;
        background-color: rgb(79,79,255);
    }
    .miic.miiorb:before {
        content: "O";
        display: block;
        background-color: rgb(255,255,79);
    }
    .miic.miicrd:before {
        content: "C";
        display: block;
        background-color: rgb(255,255,255);
    }

    .fragsdropmap {
        position: relative;
        z-index: 400;
        display: inline-block;
    }

    .fragsdropmove {
        position: relative;
        display: inline-block;
        vertical-align: top;
        margin-top: 10px;
    }

    .fragsdropmap > .fragsdroptable {
        position: relative;
    }
    .fragsdropmove > .fragsdroptable {
        position: relative;
    }
    .fragsdroptable {
        display: inline-table;
        border-collapse: separate;
        border-spacing: 0px 1px;
        text-align:center;
    }
    .fragsdroptable th {
        width: 120px;
        max-width: 120px;
        background-color: rgb(191,191,255);
        padding: 0px 6px;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
        color: rgb(0,7,39);
    }
    .fragsdroptable td {
        background-color: rgb(63,63,63);
        padding: 2px 6px;
    }

    .fragfinder {
        position: relative;
        display: inline-block;
        vertical-align: top;
        margin-top: 10px;
    }
    .fragfinder > div {
        position: relative;
        margin-left: 10px;
        width: 320px;
        max-width: 320px;
        min-height: 240px;
        border-radius: 4px;
        border: 2px solid #72729b;
    }
    .selecttargetsign {
        font-weight: bold;
        background-color: rgb(63 63 23);
        padding: 0px 6px;
    }
    .selectedsign > span {
        cursor: pointer;
        display: inline-block;
        border-radius: 4px;
        background-color: rgb(79,79,111);
        margin: 1px 4px 1px 0px;
        padding: 1px 2px;
        border: 1px solid transparent;
    }
    .selectedsign > span.selected {
        border: 1px solid rgb(255,255,159);
    }
    .selectedsign > span.halftp {
        opacity: 0.3;
    }
    .possiblefrags {
        padding-left: 10px;
    }
    .possiblefrags > span {
        display: inline-block;
        border-radius: 4px;
        background-color: rgb(95,63,63);
        margin: 1px 4px 1px 0px;
        padding: 1px 2px;
    }
</style>`);

    await (async () => {
        const currentStno = getCurrentStnoSelected();
        const eno = readSelfEno();
        const locationToItem = dlDropLocationData();
        const clearedStars = dlClearedStarSet(eno);
        const stars = dlStarsInfo();
        const signs = dlSignsInfo();
        const fragDrops = dlFragmentsDropInfo();
        const fragToSigns = dlFragmentsToSigns();

        updateMapOnMutation(await locationToItem, await clearedStars);
        includeItemInfoOnMap(await locationToItem, await clearedStars);
        appendItemIcon(await locationToItem, await clearedStars);
        addToggleTooltipsButton(await clearedStars);
        addFragmentFinder(await signs, await fragDrops, await fragToSigns);
        // addFragmentInfoTableOnMap(await stars, await fragDrops, currentStno);
        addFragmentInfoTableOnMove(await stars, await fragDrops, currentStno);
        addNotice();
        $("#maparea").on("mouseenter", ".layout[id^=stno]", function (e) {
            showTooltip(e.currentTarget);
        }).on("mouseleave", ".layout[id^=stno]", function (e) {
            hideTooltip();
        });
    })();
})();
