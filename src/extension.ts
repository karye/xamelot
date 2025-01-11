import * as vscode from 'vscode';
import * as fs from 'fs';
import { parseXSD } from './xsdparser'; // Funktion för att parsa xsd-filen

let xamlSchema: any;

export async function activate(context: vscode.ExtensionContext) {
    console.log('Activating extension Xamelot...');
    
    // Lägg till statusfält
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    statusBarItem.text = 'Xamelot';
    statusBarItem.tooltip = 'XAML Extension for Visual Studio Code';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Read paths from configuration
    const config = vscode.workspace.getConfiguration('xamelot');
    const xsdPathConfig = config.get<string>('xsdPath');
    const cachePathConfig = config.get<string>('cachePath') || 'xaml.cache.json';

    if (!xsdPathConfig) {
        console.error('XSD Path is not defined in the configuration.');
        return;
    }

    const xsdPath = vscode.Uri.file(context.asAbsolutePath(xsdPathConfig)).fsPath;
    const cachePath = vscode.Uri.file(context.asAbsolutePath(cachePathConfig)).fsPath;
    console.log('XSD Path:', xsdPath);
    console.log('Cache Path:', cachePath);

    // Registrera ett kommando
    context.subscriptions.push(
        vscode.commands.registerCommand('xamelot.refresh', async () => {
            await refreshSchema(xsdPath, cachePath);
            vscode.window.showInformationMessage('Xamelot refreshed!');
        })
    );

    // Load or parse XSD schema
    try {
        xamlSchema = await loadOrParseSchema(xsdPath, cachePath);
        console.log('XAML Schema loaded successfully:', xamlSchema);
    } catch (error) {
        console.error('Error loading or parsing XSD:', error);
        return; // Avbryt aktiveringen om parsing misslyckas
    }

    // Registrera completion provider
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { language: 'xaml' },
            new XamlCompletionProvider(xamlSchema),
            '<', ' ', '"'
        )
    );

    // Hantera automatisk stängning av taggar
    vscode.workspace.onDidChangeTextDocument(event => {
        const changes = event.contentChanges;
        for (const change of changes) {
            if (change.text === '>') {
                const line = event.document.lineAt(change.range.start.line).text;
                const tagNameMatch = line.match(/<(\w+)(\s|>)/);
                if (tagNameMatch) {
                    const tagName = tagNameMatch[1];
                    const closingTag = `</${tagName}>`;
                    const position = new vscode.Position(change.range.start.line, change.range.end.character + 1);
                    const nextChar = event.document.getText(new vscode.Range(position, position.translate(0, closingTag.length)));

                    if (nextChar !== closingTag) {
                        const edit = new vscode.WorkspaceEdit();
                        edit.insert(event.document.uri, position, closingTag);
                        vscode.workspace.applyEdit(edit);
                        console.log('Inserted closing tag:', closingTag);
                    }
                }
            }
        }
    });

    console.log('XAML extension is now active!');
}

async function loadOrParseSchema(xsdPath: string, cachePath: string): Promise<any> {
    if (fs.existsSync(cachePath)) {
        const cacheStat = fs.statSync(cachePath);
        const xsdStat = fs.statSync(xsdPath);

        if (cacheStat.mtime >= xsdStat.mtime) {
            console.log('Loading schema from cache...');
            const cachedSchema = fs.readFileSync(cachePath, 'utf-8');
            return JSON.parse(cachedSchema);
        }
    }

    console.log('Parsing XSD file...');
    const schema = await parseXSD(xsdPath);
    fs.writeFileSync(cachePath, JSON.stringify(schema, null, 2));
    return schema;
}

async function refreshSchema(xsdPath: string, cachePath: string) {
    try {
        const schema = await parseXSD(xsdPath);
        fs.writeFileSync(cachePath, JSON.stringify(schema, null, 2));
        xamlSchema = schema;
        console.log('Schema refreshed.');
    } catch (error) {
        console.error('Error refreshing schema:', error);
    }
}

class XamlCompletionProvider implements vscode.CompletionItemProvider {
    constructor(private schema: any) { }

    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
        const line = document.lineAt(position).text.substring(0, position.character).trim();
        console.log('Providing completion items for line:', line);

        const tagMatch = this.isInsideStartTag(line, position.character);
        if (tagMatch) {
            console.log('Getting attributes...', tagMatch[1]);
            return this.getAttributes(tagMatch[1]);
        } else {
            console.log('Getting elements...');
            return this.getElements();
        }
    }

    private isInsideStartTag(line: string, character: number): RegExpMatchArray | null {
        console.log('Is inside start tag...');
        const openTagIndex = line.lastIndexOf('<');
        const closeTagIndex = line.lastIndexOf('>');
        if (openTagIndex !== -1 && (closeTagIndex === -1 || openTagIndex > closeTagIndex)) {
            return line.match(/<(\w+)/);
        }
        return null;
    }

    private getElements() {
        if (!this.schema || !this.schema.elements) {
            console.warn('No elements found in schema');
            return [];
        }

        const items = Object.keys(this.schema.elements).map(key => {
            const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Class);
            return item;
        });
        return items;
    }

    private getAttributes(elementName: string) {
        if (!elementName) {
            console.warn('No element name provided');
            return [];
        }

        const attributes = this.schema.elements[elementName]?.attributes || {};
        console.log('Attributes for element:', attributes);

        return Object.keys(attributes).map(attr => {
            const item = new vscode.CompletionItem(attr, vscode.CompletionItemKind.Property);
            item.documentation = attributes[attr];
            item.insertText = new vscode.SnippetString(`${attr}=""$1`);
            return item;
        });
    }

    private getAttributeValues(line: string) {
        // Implement logic to provide attribute values if needed
        return [];
    }

    private getClosingTag(line: string) {
        const elementName = line.match(/<(\w+)/)?.[1];
        if (elementName) {
            return [new vscode.CompletionItem(`</${elementName}>`, vscode.CompletionItemKind.Snippet)];
        }
        return [];
    }
}

export function deactivate() {
    console.log('Deactivating extension...');
}