const SCENE_THEMES = {
default: {
  name: 'default',
  fontSans: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontMono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  colorText: '#18202a',
  colorTextInverse: '#dbe5ee',
  colorMuted: '#64748b',
  colorMutedInverse: '#a7b4c2',
  colorSurface: '#f7fafc',
  colorPanel: '#ffffff',
  colorPanelAlt: '#e8edf4',
  colorCodeSurface: '#0d1117',
  colorCodePage: '#0f1419',
  colorBorder: '#cbd5e1',
  colorBorderSubtle: '#e2e8f0',
  colorBorderInverse: '#2b3642',
  colorFocus: '#fde68a',
  colorFocusStrong: '#f59e0b',
  colorEmphasis: '#2563eb',
  colorEmphasisSoft: '#dbeafe',
  colorSuccess: '#16a34a',
  colorSuccessSoft: '#dcfce7',
  colorSuccessText: '#14532d',
  colorDanger: '#dc2626',
  colorDangerSoft: '#fee2e2',
  colorDangerText: '#7f1d1d',
  radius: '8px',
  strokeWidth: '2px',
  focusStrokeWidth: '3px',
  shadow: '0 24px 70px rgb(0 0 0 / 0.32)',
},
dark: {
  name: 'dark',
  fontSans: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontMono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  colorText: '#e7edf3',
  colorTextInverse: '#e7edf3',
  colorMuted: '#9aa8b6',
  colorMutedInverse: '#9aa8b6',
  colorSurface: '#101418',
  colorPanel: '#171d23',
  colorPanelAlt: '#202832',
  colorCodeSurface: '#0d1117',
  colorCodePage: '#101418',
  colorBorder: '#33404d',
  colorBorderSubtle: '#27323d',
  colorBorderInverse: '#33404d',
  colorFocus: '#fde68a',
  colorFocusStrong: '#f59e0b',
  colorEmphasis: '#60a5fa',
  colorEmphasisSoft: '#1e3a5f',
  colorSuccess: '#4ade80',
  colorSuccessSoft: '#143923',
  colorSuccessText: '#bbf7d0',
  colorDanger: '#f87171',
  colorDangerSoft: '#451a1a',
  colorDangerText: '#fecaca',
  radius: '8px',
  strokeWidth: '2px',
  focusStrokeWidth: '3px',
  shadow: '0 24px 70px rgb(0 0 0 / 0.42)',
},
};

export function sceneTheme(name = 'default') {
  return SCENE_THEMES[name] ?? SCENE_THEMES.default;
}

export function sceneThemeCssVariables(theme = sceneTheme()) {
  return `
      :root {
        --scene-font-sans: ${theme.fontSans};
        --scene-font-mono: ${theme.fontMono};
        --scene-color-text: ${theme.colorText};
        --scene-color-text-inverse: ${theme.colorTextInverse};
        --scene-color-muted: ${theme.colorMuted};
        --scene-color-muted-inverse: ${theme.colorMutedInverse};
        --scene-color-surface: ${theme.colorSurface};
        --scene-color-panel: ${theme.colorPanel};
        --scene-color-panel-alt: ${theme.colorPanelAlt};
        --scene-color-code-surface: ${theme.colorCodeSurface};
        --scene-color-code-page: ${theme.colorCodePage};
        --scene-color-border: ${theme.colorBorder};
        --scene-color-border-subtle: ${theme.colorBorderSubtle};
        --scene-color-border-inverse: ${theme.colorBorderInverse};
        --scene-color-focus: ${theme.colorFocus};
        --scene-color-focus-strong: ${theme.colorFocusStrong};
        --scene-color-emphasis: ${theme.colorEmphasis};
        --scene-color-emphasis-soft: ${theme.colorEmphasisSoft};
        --scene-color-success: ${theme.colorSuccess};
        --scene-color-success-soft: ${theme.colorSuccessSoft};
        --scene-color-success-text: ${theme.colorSuccessText};
        --scene-color-danger: ${theme.colorDanger};
        --scene-color-danger-soft: ${theme.colorDangerSoft};
        --scene-color-danger-text: ${theme.colorDangerText};
        --scene-radius: ${theme.radius};
        --scene-stroke-width: ${theme.strokeWidth};
        --scene-focus-stroke-width: ${theme.focusStrokeWidth};
        --scene-shadow: ${theme.shadow};
      }
  `;
}

export function mermaidThemeConfig(theme = sceneTheme()) {
  return {
    theme: 'base',
    themeVariables: {
      fontFamily: theme.fontSans,
      primaryColor: theme.colorPanel,
      primaryTextColor: theme.colorText,
      primaryBorderColor: theme.colorBorder,
      lineColor: theme.colorMuted,
      secondaryColor: theme.colorPanelAlt,
      tertiaryColor: theme.colorSurface,
      background: theme.colorSurface,
      mainBkg: theme.colorPanel,
      secondBkg: theme.colorPanelAlt,
      tertiaryBkg: theme.colorSurface,
      clusterBkg: theme.colorPanel,
      clusterBorder: theme.colorBorder,
      edgeLabelBackground: theme.colorSurface,
      nodeBorder: theme.colorBorder,
      titleColor: theme.colorText,
      textColor: theme.colorText,
      actorBkg: theme.colorPanel,
      actorBorder: theme.colorBorder,
      actorTextColor: theme.colorText,
      signalColor: theme.colorMuted,
      signalTextColor: theme.colorText,
    },
    flowchart: {
      htmlLabels: true,
    },
  };
}

export function shikiTheme(theme = sceneTheme()) {
  return {
    name: `${theme.name}-scene-code`,
    type: 'dark',
    colors: {
      'editor.background': theme.colorCodeSurface,
      'editor.foreground': theme.colorTextInverse,
      'editorLineNumber.foreground': theme.colorMutedInverse,
    },
    tokenColors: [
      { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#8b949e' } },
      { scope: ['string', 'constant.other.symbol'], settings: { foreground: '#a5d6ff' } },
      { scope: ['constant.numeric', 'constant.language'], settings: { foreground: '#79c0ff' } },
      { scope: ['keyword', 'storage'], settings: { foreground: '#ff7b72' } },
      { scope: ['entity.name.function', 'support.function'], settings: { foreground: '#d2a8ff' } },
      { scope: ['entity.name.type', 'support.class'], settings: { foreground: '#ffa657' } },
      { scope: ['variable', 'support.variable'], settings: { foreground: theme.colorTextInverse } },
    ],
  };
}

export function mermaidFocusClassDefs(theme = sceneTheme()) {
  return `
  classDef active fill:${theme.colorFocus},stroke:${theme.colorFocusStrong},stroke-width:${theme.focusStrokeWidth},color:${theme.colorText};
  classDef highlight fill:${theme.colorFocus},stroke:${theme.colorFocusStrong},stroke-width:${theme.focusStrokeWidth},color:${theme.colorText};
  classDef muted fill:${theme.colorPanelAlt},stroke:${theme.colorBorder},color:${theme.colorMuted};
  classDef emphasis fill:${theme.colorEmphasisSoft},stroke:${theme.colorEmphasis},stroke-width:${theme.focusStrokeWidth},color:${theme.colorText};
  classDef success fill:${theme.colorSuccessSoft},stroke:${theme.colorSuccess},stroke-width:${theme.focusStrokeWidth},color:${theme.colorSuccessText};
  classDef danger fill:${theme.colorDangerSoft},stroke:${theme.colorDanger},stroke-width:${theme.focusStrokeWidth},color:${theme.colorDangerText};
`;
}
