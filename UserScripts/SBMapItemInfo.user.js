// ==UserScript==
// @name        SBMapItemInfo
// @namespace   https://twitter.com/11powder
// @description Stella Boardの各種行動画面にアイテム情報を表示する。
// @include     /^http:\/\/stella2\.428\.st\/?(?:\?mode=action)?$/
// @version     1.0.1
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

    async function dlDropLocationData() {
        const res = await fetch(`https://dl.dropboxusercontent.com/s/l8a6jz9d35aqza6/drop.json`);
        if (!res.ok) {
            return "faileddownloading";
        }

        return await res.json();
    }

    async function dlClearedStarSet(eno) {
        const res = await fetch(`https://dl.dropboxusercontent.com/s/jt4ga191ul2362r/dropClear.json`);
        if (!res.ok) {
            return "faileddownloading";
        }

        const starsArr = (await res.json())[eno] || [];
        return new Set(starsArr);
    }

    function readSelfEno() {
        return $(".charaframeself").data("eno");
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

    function addNotice() {
        $("#maparea + p").after(`<p><small>※マップ上のツールチップや未取得アイテムのアイコンは、そのアイテムの取得後すぐには更新されません。Libra Reportと同タイミングで一日二回(朝/夕方)に行われます。</small></p>`);
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
</style>`);

    await (async () => {
        const eno = readSelfEno();
        const locationToItem = await dlDropLocationData();
        const clearedStars = await dlClearedStarSet(eno);
        updateMapOnMutation(locationToItem, clearedStars);
        includeItemInfoOnMap(locationToItem, clearedStars);
        appendItemIcon(locationToItem, clearedStars);
        addToggleTooltipsButton(clearedStars);
        addNotice();
        $("#maparea").on("mouseenter", ".layout[id^=stno]", function (e) {
            showTooltip(e.currentTarget);
        }).on("mouseleave", ".layout[id^=stno]", function (e) {
            hideTooltip();
        });
    })();
})();
