import * as vscode from 'vscode';
import { parseXSD, generateGrammarFromXSD } from './xsdparser'; // Funktion för att parsa xsd-filen och generera grammatik

let xamlSchema: any;

export async function activate(context: vscode.ExtensionContext) {
    console.log('Activating extension Xamelot...');
    const xsdPath = vscode.Uri.file(context.extensionPath + '/syntax/sample.xaml.xsd');
    const grammarPath = vscode.Uri.file(context.extensionPath + '/syntax/xaml.tmLanguage.json');
    console.log('XSD Path:', xsdPath.fsPath);
    console.log('Grammar Path:', grammarPath.fsPath);

    // Lägg till statusfält
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    statusBarItem.text = 'Xamelot';
    statusBarItem.tooltip = 'XAML Extension for Visual Studio Code';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Registrera ett kommando
    context.subscriptions.push(
        vscode.commands.registerCommand('xamelot.refresh', () => {
            vscode.window.showInformationMessage('Xamelot refreshed!');
        })
    );

    // Läs och parse XSD-filen
    try {
        xamlSchema = await parseXSD(xsdPath.fsPath);
        console.log('XAML Schema loaded successfully:', xamlSchema);
    } catch (error) {
        console.error('Error parsing XSD:', error);
        return; // Avbryt aktiveringen om parsing misslyckas
    }

    // Generera tmLanguage-fil
    try {
        await createGrammarFile(xamlSchema, grammarPath.fsPath);
    } catch (error) {
        console.error('Error creating grammar file:', error);
        return; // Avbryt aktiveringen om grammar-filen inte kan skapas
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