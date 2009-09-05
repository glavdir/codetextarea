dojo.provide("nic.widget._codeTextArea.plugins.BlinkingCaret");
nic.widget._codeTextArea.plugins.BlinkingCaret.startup = function(args){
    this._blinkInterval = setInterval(dojo.hitch(args.source,function(){
        this.caret.style.visibility = 
            this.caret.style.visibility == "hidden" ? "visible" : "hidden"; 
    }), 500);
};