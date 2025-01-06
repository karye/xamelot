import * as fs from 'fs';
import * as xml2js from 'xml2js';

export async function parseXSD(filePath: string) {
  const xsdContent = fs.readFileSync(filePath, 'utf-8');
  const parser = new xml2js.Parser();
  const result = await parser.parseStringPromise(xsdContent);

  const schema: { elements: { [key: string]: { attributes: string[], childElements: string[] } } } = { elements: {} };

  // Parse schema-komponenter
  result.schema.group.forEach((group: any) => {
    const groupName = group.$.name;
    const elements = group['xs:element'] || [];
    schema.elements[groupName] = {
      attributes: [],
      childElements: elements.map((el: any) => el.$.ref)
    };
  });
  
  return schema;
}

export function generateGrammarFromXSD(schema: any): any {
  const patterns: any[] = [];

  // Lägg till regler för element
  for (const elementName in schema.elements) {
    patterns.push({
      name: `entity.name.tag.xaml`,
      match: `<${elementName}`
    });
  }

  // Lägg till regler för attribut
  for (const elementName in schema.elements) {
    for (const attributeName in schema.elements[elementName].attributes) {
      patterns.push({
        name: `variable.parameter.attribute.xaml`,
        match: `\\b${attributeName}=`
      });
    }
  }

  return {
    scopeName: "source.xaml",
    patterns: patterns,
    repository: {}
  };
}
