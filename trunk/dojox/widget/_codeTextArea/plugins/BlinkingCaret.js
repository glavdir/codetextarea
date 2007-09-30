dojo.provide("dojox.widget._codeTextArea.plugins.BlinkingCaret");
dojox.widget._codeTextArea.plugins.BlinkingCaret.startup = function(){
    this._blinkInterval = setInterval(dojo.hitch(this,function(){
        this.caret.style.visibility = 
            this.caret.style.visibility == "hidden" ? "visible" : "hidden"; 
    }), 500);
};