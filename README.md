# Eric's Build Output Colorizer

Eric's Build Output Colorizer is a fork of the excellent [Build Output
Colorizer](https://marketplace.visualstudio.com/items?itemName=SteveBushResearch.BuildOutputColorizer)
from Steve Bush. It applies syntax highlighting to the VSCode Output window,
restoring colors to build diagnostics that (especially with CMake builds) are
stripped away. It recognizes errors and warnings generated from the
[stdexec](https://github.com/NVIDIA/stdexec) library and highlights them to make
it easier to diagnose what is going wrong.

## Features

This no-code extension associates syntax highlighting rules to the Output window
scope, and uses regexes to select and highlight patterns that are probably
error/warning diagnostics.

![Example Output](assets/screenshot1.png "Example Output")

## Requirements

This extensions should not have any prerequisites or requirements.  The
highlighting rules should work with any theme, but the colors are not
theme-based (though they are customizable via settings).

## Extension Settings

This extension changes the default for `editor.tokenColorCustomizations` to
allow customization of the highlighting.  If you have customizations already,
you may need to manually add color settings for the TextMate tokens shown below:
```
{
    "editor.tokenColorCustomizations": {
    "textMateRules": [
        {
            "scope" : "markup.other.log.error",
            "settings": { "foreground": "#FF0000" }
        },
        {
            "scope" : "markup.bold.log.error",
            "settings": {
                "foreground": "#FF0000",
                "fontStyle": "bold underline"
            },
        },
        {
            "scope" : "markup.other.log.warn",
            "settings": { "foreground": "#c500f7cc" }
        },
        {
            "scope" : "markup.other.log.info",
            "settings": { "foreground": "#2cd3c5" }
        },
        {
            "scope" : "markup.other.log.debug",
            "settings": { "foreground": "#888585" }
        },
        {
            "scope" : "markup.other.log.highlight",
            "settings": { "foreground": "#19ff04" }
        }
    ]
    }
}
```
This also allows for customization to your preferences.

## Known Issues
This extension has a quite limited set of syntax highlighting rules since
normally the objective of compiler diagnostics is to draw the user's eye to the
highest priority items.

Contributions or suggestions for improvement are welcome.  Please raise an issue
at the extension's
[repository](https://github.com/ericniebler/buildoutputcolorizer).
