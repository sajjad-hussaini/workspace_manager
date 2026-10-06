import { useMemo, useState } from "react";
import { tabMatchesSearch } from "../../../lib/utils";
import { Icon, LinkFavicon } from "./Icons";
import SearchHighlight from "./SearchHighlight";
import SearchNote from "./SearchNote";
import TabIndicators from "./TabIndicators";
import "./SearchResults.css";
import { normalizeTag } from "../../../lib/tags";

export default function SearchResults({ query, sessions, loading, renderWorkspace, onOpenTab, onShowWorkspace, onTagClick, getFaviconUrl }) {
  const [showAllTabs, setShowAllTabs] = useState(false);
  const tabResults = useMemo(() => sessions.flatMap((session) =>
    (session.tabs || []).flatMap((tab, tabIndex) =>
      tabMatchesSearch(tab, query) ? [{ session, tab, tabIndex }] : []
    )
  ), [sessions, query]);
  const count = sessions.length + tabResults.length;
  const visibleTabs = showAllTabs ? tabResults : tabResults.slice(0, 4);

  return (
    <div className="search-results">
      <header className="modern-page-header">
        <span className="modern-eyebrow">Search results</span>
        <h1 className="modern-main-heading">Results for “{query}”</h1>
        <p className="modern-subtitle" role="status">
          {loading ? "Searching…" : `${count} result${count === 1 ? "" : "s"} across your workspaces and saved tabs`}
        </p>
      </header>
      {loading ? <div className="final-empty">Loading results…</div> : <>
        <section className="search-result-section" aria-labelledby="search-workspaces-heading">
          <h2 className="search-section-heading" id="search-workspaces-heading">Workspaces <span>· {sessions.length} {sessions.length === 1 ? "result" : "results"}</span></h2>
          <div className="search-workspace-list">
            {sessions.length ? sessions.map(renderWorkspace) : <div className="final-empty">No workspaces match your search.</div>}
          </div>
        </section>
        <section className="search-result-section" aria-labelledby="search-tabs-heading">
          <h2 className="search-section-heading" id="search-tabs-heading">Tabs <span>· {tabResults.length} {tabResults.length === 1 ? "result" : "results"}</span></h2>
          <div className="search-tab-list">
            <div id="search-tab-results">
              {visibleTabs.map(({ session, tab, tabIndex }) => {
                const tags = Array.isArray(tab.tags) ? tab.tags : tab.tags ? [tab.tags] : [];
                const displayUrl = (tab.url || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
                return (
                  <article className="search-tab-row" key={`${session.id}:${tabIndex}`}>
                    <LinkFavicon tab={tab} getFaviconUrl={getFaviconUrl} />
                    <div className="search-tab-copy">
                      <button className="search-tab-title" type="button" onClick={() => onOpenTab(session, tabIndex)}>
                        <SearchHighlight text={tab.title || tab.url || "Untitled tab"} query={query} />
                      </button>
                      <div className="search-tab-url" title={tab.url}><SearchHighlight text={displayUrl} query={query} /></div>
                      <SearchNote note={tab.note} query={query} />
                      <div className="search-tab-context">
                        <span>In:</span>
                        <button className="search-workspace-link" type="button" onClick={() => onShowWorkspace(session.id)}>{session.title || "Untitled workspace"}</button>
                        <TabIndicators tab={tab} />
                        {tags.map((tag, index) => <button type="button" className="search-tab-tag" key={index} onClick={() => onTagClick(tag)} title={`Search #${normalizeTag(tag)}`}>#<SearchHighlight text={normalizeTag(tag)} query={query} /></button>)}
                      </div>
                    </div>
                    <button className="search-tab-open" type="button" aria-label={`Open ${tab.title || tab.url}`} title="Open tab" onClick={() => onOpenTab(session, tabIndex)}><Icon name="external" /></button>
                  </article>
                );
              })}
              {!tabResults.length && <div className="final-empty">No saved tabs match your search.</div>}
            </div>
            {tabResults.length > 4 && <button className="search-view-all" type="button" aria-expanded={showAllTabs} aria-controls="search-tab-results" onClick={() => setShowAllTabs((value) => !value)}>
              {showAllTabs ? "Show fewer tab results" : `View all ${tabResults.length} tab results`} <Icon name={showAllTabs ? "chevron-up" : "chevron-down"} />
            </button>}
          </div>
        </section>
      </>}
    </div>
  );
}
