import * as fs from 'fs';
import * as xml2js from 'xml2js';

export async function parseXSD(filePath: string) {
  const xsdContent = fs.readFileSync(filePath, 'utf-8');
  const parser = new xml2js.Parser();
  const result = await parser.parseStringPromise(xsdContent);
  console.log('Parsed XSD Result:', result);

  const schema: { elements: { [key: string]: { attributes: string[], childElements: string[] } } } = { elements: {} };

  // Kontrollera om schema och complexType-egenskapen finns
  if (result['xs:schema']) {
    const schemaElements = result['xs:schema']['xs:element'] || [];
    schemaElements.forEach((element: any) => {
      const elementName = element.$.name;
      const type = element.$.type;
      const complexType = result['xs:schema']['xs:complexType'].find((ct: any) => ct.$.name === type);
      const attributes = complexType ? complexType['xs:attribute'] || [] : [];
      schema.elements[elementName] = {
        attributes: attributes.map((attr: any) => attr.$.name),
        childElements: []
      };
    });
  } else {
    console.warn('No schema found in the XSD file.');
  }
  
  console.log('Parsed schema:', schema);
  return schema;
}

export function generateGrammarFromXSD(schema: any): any {
  const patterns: any[] = [];

  // Kontrollera om elements-egenskapen finns
  if (schema.elements) {
    // Lägg till regler för element
    for (const elementName in schema.elements) {
      patterns.push({
        name: `entity.name.tag.xaml`,
        match: `<${elementName}`
      });
    }

    // Lägg till regler för attribut
    for (const elementName in schema.elements) {
      for (const attributeName of schema.elements[elementName].attributes) {
        patterns.push({
          name: `variable.parameter.attribute.xaml`,
          match: `\\b${attributeName}=`
        });
      }
    }
  } else {
    console.warn('No elements found in the schema.');
  }

  return {
    scopeName: "source.xaml",
    patterns: patterns,
    repository: {}
  };
}