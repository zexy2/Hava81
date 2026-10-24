export interface LiveAuditChromium<TBrowser> {
  launch(options: {
    timeout: number;
    executablePath: string | undefined;
    args: string[];
  }): Promise<TBrowser>;
  connectOverCDP(endpoint: string): Promise<TBrowser>;
}

export function launchLiveAuditBrowser<TBrowser>(
  chromium: LiveAuditChromium<TBrowser>,
  env?: Record<string, string | undefined>,
): Promise<TBrowser>;
