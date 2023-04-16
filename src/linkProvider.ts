'use strict';
// import * as ts from "typescript";
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const unixPathSeparator = '/';
const unixPathPrefix = '\\.\\.?|~';
// '":; are allowed in paths but they are often separators so ignore them
// Also disallow \\ to prevent a catastropic backtracking case #24798
const unixFileName = '(?:[^\\0!$`&*()\\[\\]+\'":;\\\\ ]|\\\\ )+';

/** A regex that matches paths in the form /foo, ~/foo, ./foo, ../foo, foo/bar */
const unixLocalLink = `(?:${unixPathPrefix}|${unixFileName}|)(?:${unixPathSeparator}${unixFileName})+`;

const winDrivePrefix = '[a-zA-Z]:';
const winPathPrefix = `${winDrivePrefix}|\\.\\.?|~`;
const winPathSeparator = '[\\\\/]';
const winFileName = '(?:[^\\0<>\\?\\|\\/!$`&*()\\[\\]+\'":; ]|\\\\ )+';

/** A regex that matches paths in the form c:\foo, ~\foo, .\foo, ..\foo, foo\bar */
const winLocalLink = `(?:${winPathPrefix}|${winFileName}|)(?:${winPathSeparator}${winFileName})+`;

/**
 * As xterm reads from DOM, space in that case is nonbreaking char ASCII code - 160,
 * replacing space with nonBreakningSpace or space ASCII code - 32.
 */
const lineAndColumn = [
    // "(file path)", line 45 [see #40468]
    '\\S*", line (?<line1>\\d+)(?: column (?<column1>\\d+))?',

    // (file path) on line 8, column 13
    '\\S* on line (?<line2>\\d+)(?:, column (?<column2>\\d+))?',

    // (file path):line 8, column 13
    '\\S*:line (?<line3>\\d+)(?:, column (?<column3>\\d+))?',

    // (file path)(45), (file path) (45), (file path)(45,18), (file path) (45,18), (file path)(45, 18), (file path) (45, 18), also with []
    '[^\\s\\(\\)]*\\s?[\\(\\[](?<line4>\\d+)(?:,\\s?(?<column4>\\d+))?[\\)\\]]',

    // (file path):336, (file path):336:9
    '[^:\\s\\(\\)<>\'"\\[\\]]*(?::(?<line5>\\d+))?(?::(?<column5>\\d+))?',
]
    .join('|')
    .replace(/ /g, `[${'\u00A0'} ]`);

export class LinkProvider implements vscode.DocumentLinkProvider {
    private processCwd: string | undefined;
    private localLinkPattern: RegExp;
    private currentWorkspaceFolder: vscode.WorkspaceFolder | undefined;

    //private configuration: IConfiguration;
    private lineSeparator: RegExp = /\r?\n/;

    constructor() {
        const baseLocalLink = process.platform === 'win32' ? winLocalLink : unixLocalLink;

        // Append line and column number regex
        this.localLinkPattern = new RegExp(`(?<path>${baseLocalLink})(${lineAndColumn})`, 'g');

        this.currentWorkspaceFolder = vscode.workspace.workspaceFolders?.at(0);
    }

    public async provideDocumentLinks(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.DocumentLink[]> {
        let results: vscode.DocumentLink[] = [];

        this.currentWorkspaceFolder = vscode.workspace.workspaceFolders?.at(0);
        this.processCwd = this.currentWorkspaceFolder?.uri.fsPath;
        let lines = document.getText().split(this.lineSeparator);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            let result = await this.getLinksOnLine(line, i);

            if (result.length > 0) {
                results.push(...result);
            }
        }

        return Promise.resolve(results);
    }

    public async getLinksOnLine(line: string, lineNumber: number) {
        const results: vscode.DocumentLink[] = [];

        let match: RegExpMatchArray | null = null;

        this.localLinkPattern.lastIndex = 0;

        while ((match = this.localLinkPattern.exec(line))) {
            if (!match.index) {
                continue;
            }
            let start = match.index;
            let end = match.index + match[0].length;
            let linkUrl = match.groups?.path;
            if (!linkUrl) {
                continue;
            }
            let resolvedPath = this.processCwd ? await this.resolvePath(linkUrl) : linkUrl;
            if (!resolvedPath) {
                continue;
            }

            linkUrl = path.normalize(resolvedPath);

            if (!(await this.fileExists(linkUrl))) {
                continue;
            }

            if (!(await this.isFile(linkUrl))) {
                continue;
            }

            let fileUri = vscode.Uri.file(linkUrl);

            // Fetch the line and column
            let uriLineNumber = 1;
            let uriColumnNumber = 1;

            let lineString = match.groups?.line1 ??
                             match.groups?.line2 ??
                             match.groups?.line3 ??
                             match.groups?.line4 ??
                             match.groups?.line5;
            if (lineString) {
                uriLineNumber = parseInt(lineString, 10);

                let columnString = match.groups?.column1 ??
                                   match.groups?.column2 ??
                                   match.groups?.column3 ??
                                   match.groups?.column4 ??
                                   match.groups?.column5;
                if (columnString) {
                    uriColumnNumber = parseInt(columnString, 10);
                }
            }

            // Create a link target by combining the URI with the line and column
            const linkTarget = fileUri.with({ fragment: `${uriLineNumber},${uriColumnNumber}` });

            results.push(new vscode.DocumentLink(new vscode.Range(new vscode.Position(lineNumber, start), new vscode.Position(lineNumber, end)), linkTarget));
        }

        return results;
    }

    private preprocessPath(link: string): string | null {
        if (process.platform === 'win32') {
            // Resolve ~ -> %HOMEDRIVE%\%HOMEPATH%
            if (link.charAt(0) === '~') {
                if (!process.env.HOMEDRIVE || !process.env.HOMEPATH) {
                    return null;
                }

                link = `${process.env.HOMEDRIVE}\\${process.env.HOMEPATH + link.substring(1)}`;
            }

            // Resolve relative paths (.\a, ..\a, ~\a, a\b)
            if (!link.match('^' + winDrivePrefix)) {
                if (!this.processCwd) {
                    // Abort if no workspace is open
                    return null;
                }

                link = path.join(this.processCwd, link);
            }
        } else if (link.charAt(0) !== '/' && link.charAt(0) !== '~') {
            // Resolve workspace path . | .. | <relative_path> -> <path>/. | <path>/.. | <path>/<relative_path>

            if (!this.processCwd) {
                // Abort if no workspace is open
                return null;
            }

            link = path.join(this.processCwd, link);
        }

        return link;
    }

    private async resolvePath(link: string): Promise<string | null> {
        let preprocessedLink: string | null = null;

        try {
            preprocessedLink = this.preprocessPath(link);
        } catch (error) {}

        if (!preprocessedLink) {
            return link;
        }

        return preprocessedLink;
    }

    private async fileExists(_path: string): Promise<boolean> {
        try {
            fs.accessSync(_path);

            return true;
        } catch (error) {
            return false;
        }
    }

    private async isFile(_path: string): Promise<boolean> {
        try {
            let stat = await fs.lstatSync(_path);

            return stat.isFile();
        } catch (error) {
            return false;
        }
    }

    private resolveWorkspaceFolders() {
        let folders = vscode.workspace.workspaceFolders;

        if (!folders) {
            console.log('workspaceFolders is null');
            return;
        }

        for (let i = 0; i < folders.length; i++) {
            const folder = folders[i];

            console.log(`${folder.name}:`, folder.uri.fsPath);
        }
    }
}
