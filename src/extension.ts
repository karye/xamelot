import * as vscode from 'vscode';
import { parseXSD } from './xsdparser'; // Funktion för att parsa xsd-filen
import { generateGrammarFromXSD } from './xsdparser';

let xamlSchema: any;

export async function activate(context: vscode.ExtensionContext) {
    console.log('Activating extension Xamelot...');
    const xsdPath = vscode.Uri.file(context.extensionPath + '/syntax/xaml.xsd');
    const grammarPath = vscode.Uri.file(context.extensionPath + '/syntax/xaml.tmLanguage.json');
    console.log('XSD Path:', xsdPath);
    console.log('Grammar Path:', grammarPath);
    
    // Add text in status bar
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    statusBarItem.text = 'Xamelot';
    statusBarItem.tooltip = 'XAML Extension for Visual Studio Code';
    statusBarItem.show();

    // Register the command
    context.subscriptions.push(
        vscode.commands.registerCommand('xamelot.refresh', () => {
            vscode.window.showInformationMessage('Hello, Xamelot!');
        })
    );

    // Läs och parse xsd-filen
    try {
        xamlSchema = await parseXSD(xsdPath.fsPath);
        console.log('XAML Schema:', xamlSchema);
    } catch (error) {
        console.error('Error parsing XSD:', error);
    }

    // Generera tmLanguage-fil
    try {
        await createGrammarFile(xamlSchema, grammarPath.fsPath);
    } catch (error) {
        console.error('Error creating grammar file:', error);
    }

    // Register the completion provider
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { language: 'xaml' },
            new XamlCompletionProvider(xamlSchema),
            '<', ' ', '"'
        )
    );

    vscode.workspace.onDidChangeTextDocument(event => {
        const changes = event.contentChanges;
        for (const change of changes) {
            if (change.text === '>') {
                const line = event.document.lineAt(change.range.start.line).text;
                const tagNameMatch = line.match(/<(\w+)(\s|>)/);
                if (tagNameMatch) {
                    const tagName = tagNameMatch[1];
                    const closingTag = `</${tagName}>`;
                    const edit = new vscode.WorkspaceEdit();
                    const position = new vscode.Position(change.range.start.line, change.range.end.character + 1);
                    edit.insert(event.document.uri, position, closingTag);
                    vscode.workspace.applyEdit(edit);
                    console.log('Inserted closing tag:', closingTag);
                }
            }
        }
    });

    console.log('XAML extension is now active!');
}

class XamlCompletionProvider implements vscode.CompletionItemProvider {
    constructor(private schema: any) { }

    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
        const line = document.lineAt(position).text.substring(0, position.character).trim();
        console.log('Providing completion items for line:', line);

        if (line.startsWith('<')) {
            console.log('Detected "<", providing element completions');
            return this.getElements();
        } else if (line.match(/<\w+\s+\w*$/)) {
            console.log('Detected element with attributes, providing attribute completions');
            return this.getAttributes(line);
        } else if (line.match(/<\w+\s+\w+=".*$/)) {
            console.log('Detected attribute value, providing closing tag completions');
            return this.getClosingTag(line);
        }

        return undefined;
    }

    private getElements() {
        console.log('Getting elements...');
        const items = Object.keys(this.schema.elements).map(key => {
            const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Class);
            console.log('Created completion item:', item);
            return item;
        });
        return items;
    }

    private getAttributes(line: string) {
        console.log('Getting attributes for line:', line);
        const elementName = line.match(/<(\w+)/)?.[1];
        const attributes = elementName ? this.schema.elements[elementName]?.attributes || [] : [];
        const items = attributes.map((attr: string) => {
            const item = new vscode.CompletionItem(attr, vscode.CompletionItemKind.Property);
            console.log('Created completion item:', item);
            return item;
        });
        return items;
    }

    private getClosingTag(line: string) {
        console.log('Getting closing tag for line:', line);
        const elementName = line.match(/<(\w+)/)?.[1];
        if (elementName) {
            const item = new vscode.CompletionItem(`</${elementName}>`, vscode.CompletionItemKind.Snippet);
            console.log('Created completion item:', item);
            return [item];
        }
        return [];
    }
}

async function createGrammarFile(schema: any, outputPath: string) {
    console.log('Creating grammar file...');
    const grammar = generateGrammarFromXSD(schema);
    const fs = require('fs');
    fs.writeFileSync(outputPath, JSON.stringify(grammar, null, 2));
    console.log('Grammar file created at:', outputPath);
}

export function deactivate() {
    console.log('Deactivating extension...');
}