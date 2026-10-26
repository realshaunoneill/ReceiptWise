import React from 'react';
import { View } from 'react-native';
import { parseSummary, type Inline } from '@shared/insights/summary-markdown';
import { space } from '../theme';
import Text from '../ui/Text';

function Runs({ parts }: { parts: Inline[] }) {
  return <>{parts.map((part, index) => (part.bold ? <Text key={index} variant="callout" weight="semibold">{part.text}</Text> : part.text))}</>;
}

/** The model's Markdown as headings, paragraphs and lists, through the website's parser. Never as HTML. */
export default function SummaryText({ markdown }: { markdown: string }) {
  return (
    <View style={{ gap: space.md }}>
      {parseSummary(markdown).map((block, index) => {
        if (block.type === 'heading') {
          return <Text key={index} variant="label" accessibilityRole="header"><Runs parts={block.content} /></Text>;
        }
        if (block.type === 'list') {
          return (
            <View key={index} style={{ gap: space.xs }}>
              {block.items.map((item, itemIndex) => (
                <View key={itemIndex} style={{ flexDirection: 'row', gap: space.sm }}>
                  <Text variant="callout" ink="muted" style={{ minWidth: 16 }}>{block.ordered ? `${itemIndex + 1}.` : '•'}</Text>
                  <Text variant="callout" ink="secondary" style={{ flex: 1 }}><Runs parts={item} /></Text>
                </View>
              ))}
            </View>
          );
        }
        return <Text key={index} variant="callout" ink="secondary"><Runs parts={block.content} /></Text>;
      })}
    </View>
  );
}
