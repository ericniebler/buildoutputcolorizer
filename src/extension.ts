// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { LinkProvider } from './linkProvider';
import nonOutputLanguageIds from './nonOutputLanguageIds';

let unknownLanguageIds: string[] = [];
let outputChannel = vscode.window.createOutputChannel('Eric\'s Build Output Colorizer');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	let linkProvider = new LinkProvider();
	let languagesIds: string[] | undefined = vscode.workspace.getConfiguration('erics-build-output-colorizer', null).get('languagesIds');

	if (!languagesIds) {
		outputChannel.clear();
		outputChannel.show();
		outputChannel.append('No languages specified');
		return;
	}

	let outputLinkProvider = vscode.languages.registerDocumentLinkProvider(languagesIds, linkProvider);

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((_e: any) => {
			outputLinkProvider.dispose();

			languagesIds = vscode.workspace.getConfiguration('erics-build-output-colorizer', null).get('languagesIds');
			if (!languagesIds) {
				outputChannel.clear();
				outputChannel.show();
				outputChannel.append('No languages specified');
				return;
			}

			outputLinkProvider = vscode.languages.registerDocumentLinkProvider(languagesIds, linkProvider);
		})
	);
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor((editor: { document: { languageId: string; }; } | undefined) => {
			if (!languagesIds) {
				outputChannel.clear();
				outputChannel.show();
				outputChannel.append('No languages specified');
				return;
			}

			if (editor !== undefined && !languagesIds.includes(editor.document.languageId) && !nonOutputLanguageIds.includes(editor.document.languageId) && !unknownLanguageIds.includes(editor.document.languageId)) {
				unknownLanguageIds.push(editor.document.languageId);
			}
		})
	);

	context.subscriptions.push(outputLinkProvider);
}

// This method is called when your extension is deactivated
export function deactivate() { }
