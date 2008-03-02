dojo.provide("dojox.widget._codeTextArea.plugins.Bookmarks");
dojo.require("dijit.Menu");
dojo.require("dijit.Dialog");

dojox.widget._codeTextArea.plugins.Bookmarks.startup = function(args){
	var targetLine = 0;
	var targetBookmark = {};
    var source = args.source;
	var areaId = source.id;
	var area = dijit.byId(areaId);
	var areaCoords = dojo.coords(area.domNode);
	var lineHeight = area.lineHeight;

	// right bar
	var bookmarksBar = document.createElement("div");
	bookmarksBar.className = "codeTextAreaBookmarksBar";
	bookmarksBar.style.top = areaCoords.y + "px";
	bookmarksBar.style.left = areaCoords.x + area.width + "px";
	bookmarksBar.style.height = area.height + "px";
	document.body.appendChild(bookmarksBar);

	// dialog
	var _bookmarkDialogNode = document.createElement("div");
	var _caption = document.createElement("span");
	_caption.appendChild(document.createTextNode("Enter Bookmark name: "));
	var _bookmarkField = document.createElement("input");
	_bookmarkField.type = "text";
	_bookmarkField.name = "bookmarkName";
	_bookmarkField.value = "";
	_caption.className = "codeTextAreaDialogCaption";
	_bookmarkDialogNode.appendChild(_caption)
	_bookmarkDialogNode.appendChild(_bookmarkField);
	var bookmarkDialog = new dijit.Dialog({
	        title: "Add Bookmark",
	        duration: 40
	    }, _bookmarkDialogNode
    );	
    dojo.connect(bookmarkDialog, "hide", 
		function(){ 
			bookmarkDialog.domNode.getElementsByTagName("input")[0].blur();  
			source._blockedEvents = false;
            document.body.focus();
	});
    dojo.connect(bookmarkDialog.titleBar, "focus", function(){
            _bookmarkField.focus();  
            _bookmarkField.select();  
    });
	area.showBookmarkDialog = function(index){
		source._blockedEvents = true;
		_bookmarkField.value = source.getLineContent(source.linesCollection[index]);
		bookmarkDialog.show();
	};
	area.enableBookmark = function(index){
		var targetBookmark = dojo.query("div.bookmarkPlaceholder", area.leftBand.getElementsByTagName("li")[index])[0];
		var bookmark = document.createElement("div");
		bookmark.className = "codeTextAreaBookmark";
		bookmark.style.left = "0px";
		bookmark.style.top = parseInt((index / area.linesCollection.length)*area.height) + "px";
		bookmarksBar.appendChild(bookmark);
		targetBookmark.title = _bookmarkField.value;
		bookmark.title = _bookmarkField.value;
		targetBookmark.style.visibility = "visible";
	};
    dojo.connect(_bookmarkField, "onkeypress", function(evt){
            var evt = dojo.fixEvent(evt||window.event);
			var _value;            
            if(evt.keyCode == 13){
				source.enableBookmark(targetLine);
                bookmarkDialog.hide();
                dojo.stopEvent(evt);
	            document.body.focus();
            }
    });
	var addBookmark = function(e){
		area.showBookmarkDialog(targetLine);
	};
	var onMenuOpen = function(e){
		targetLine = parseInt((e.y - areaCoords.y) / lineHeight);
	};
	var leftBandMenu = new dijit.Menu({targetNodeIds: [area.leftBand.id], id:[area.leftBand.id] + "-menu"});
	leftBandMenu.addChild(new dijit.MenuItem({
			label: "Add a bookmark", 
			onClick: function(e){ addBookmark(e); } 
		})
	);
	dojo.connect(leftBandMenu, "onOpen", this, function(e){ onMenuOpen(e); });
	leftBandMenu.startup();
};