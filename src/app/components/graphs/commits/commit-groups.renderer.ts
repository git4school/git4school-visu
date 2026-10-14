import * as d3 from "d3";
import { Commit } from "@models/Commit.model";
import { Repository } from "@models/Repository.model";
import { TooltipService } from "@services/tooltip.service";
import { Utils } from "@services/utils";

/**
 * Commit rows and their "group" collapse: the rounded fuse path, the card/group components, the
 * display modes (opacity, height, text) and the helpers that split a group back into commits.
 *
 * Extracted from `CommitsComponent` (263 lines). The hover/click listeners stay inside the created
 * components, so this module only needs the graph state through the host below.
 */

/** Height of a collapsed group row (was `CommitsComponent.GROUP_HEIGHT`). */
export const COMMIT_GROUP_HEIGHT = 12;

/** View members the commit groups need from `CommitsComponent`. */
export interface CommitGroupsHost {
  /** Active display modes (opacity / height / text). */
  displayModes: { opacity: boolean; height: boolean; text: boolean };
  /** One D3 group per repository. */
  repositories_g: d3.Selection<any, Repository, any, any>[];
  /** Hovered commit, its group and its repository (tooltips). */
  hovered_commit: Commit;
  hovered_group_commit: Commit[];
  hovered_repository: Repository;
  hovered_g: d3.Selection<any, any, any, any>;
  tooltipService: TooltipService;
  xScaledTimeZoned(date: Date | string): number;
  zoomToGroup(commits: Commit[], range: number): void;
  /** Rebuilds a repository row after a grouping change. */
  refreshRepoByGrouping(repo_g: any, didSplit?: boolean): void;
  /** Splits an over-wide group, returns whether it happened. */
  refreshRepoBySplittingGroup(repo_g: any): boolean;
}

export class CommitGroupsRenderer {
  public static getCommitGroupPathD(host: CommitGroupsHost, first: Commit, last: Commit, height: number = COMMIT_GROUP_HEIGHT): any {
    let begin_x = host.xScaledTimeZoned(first.commitDate);
    let end_x = host.xScaledTimeZoned(last.commitDate);

    let actualWidth = end_x - begin_x;
    let minWidth = 10; // Reduced from 14
    let width = Math.max(actualWidth, minWidth);

    let arcRadius = height / 2;
    let extraWidth = last.isCloture ? arcRadius : 0;

    // Centers the visual shape (including the arc) over the actual commit span.
    let visualWidth = width + extraWidth;
    let offset = (actualWidth - visualWidth) / 2;

    if (last.isCloture) {
      return `M ${offset} 0 h ${width} a ${arcRadius} ${arcRadius} 0 0 1 0 ${height} H ${offset} z`;
    } else {
      return `M ${offset} 0 h ${width} v ${height} H ${offset} z`;
    }
  }

  public static getCommitGroupComponentFromScratch(
    host: CommitGroupsHost,
    parent: d3.Selection<any, Repository, any, any>,
    commits: Commit[],
  ): any {
    let sorted = commits.sort((a, b) => a.commitDate.getTime() - b.commitDate.getTime());

    let g = parent.insert("g", ".commit:not(.commit-group)").datum(sorted);

    let begin_x = host.xScaledTimeZoned(sorted[0].commitDate);

    g.attr("class", "commit-group commit")
      .append("path")
      .attr("d", CommitGroupsRenderer.getCommitGroupPathD(host, sorted[0], sorted[sorted.length - 1], COMMIT_GROUP_HEIGHT))
      .style("--y-offset", `${-COMMIT_GROUP_HEIGHT / 2}px`)
      .attr("fill", sorted[sorted.length - 1].color.color)
      .attr("class", "data");

    let range = 0;
    for (let i = 0; i < commits.length - 1; i++) {
      range = Math.max(range, commits[i + 1].commitDate.getTime() - commits[i].commitDate.getTime());
    }

    g.attr("group_range", range);
    g.attr("transform", `translate(${begin_x}, 0)`)
      .on("mouseenter", (e, d) => {
        host.hovered_commit = undefined;
        host.hovered_group_commit = d;
        host.hovered_g = g;
        host.hovered_repository = undefined;
      })
      .on("mouseleave", () => {
        if (host.hovered_g?.node() === g.node()) {
          host.hovered_g = null;
          host.hovered_group_commit = undefined;
        }
      })
      .on("click", (e, d) => {
        let currentRange = parseFloat(g.attr("group_range")) || 0;
        host.zoomToGroup(d, currentRange);
      });

    return g;
  }

  public static getCommitGroupComponent(
    host: CommitGroupsHost,
    parent: d3.Selection<any, Repository, any, any>,
    group: d3.Selection<any, Commit[], any, any> | undefined,
    commit: Commit,
  ): any {
    let g;

    if (group == null) {
      let x = host.xScaledTimeZoned(commit.commitDate);

      g = parent.insert("g", ".commit:not(.commit-group)").datum([commit]);

      g.attr("class", "commit-group")
        .append("path")
        .attr("d", CommitGroupsRenderer.getCommitGroupPathD(host, commit, commit, COMMIT_GROUP_HEIGHT))
        .style("--y-offset", `${-COMMIT_GROUP_HEIGHT / 2}px`)
        .attr("fill", commit.color.color)
        .attr("class", "data")
        .on("mouseenter", (e, d) => {
          host.hovered_commit = undefined;
          host.hovered_group_commit = d;
          host.hovered_g = g;
          host.hovered_repository = undefined;
        })
        .on("mouseleave", () => {
          if (host.hovered_g?.node() === g.node()) {
            host.hovered_g = null;
            host.hovered_group_commit = undefined;
          }
        });

      g.on("click", (e, d) => {
        let currentRange = parseFloat(g.attr("group_range")) || 0;
        host.zoomToGroup(d, currentRange);
      });

      g.attr("transform", `translate(${x}, 0)`);
    } else {
      if (group.select("path").empty()) {
        let group_commit = group.datum()[0];
        let before_date = group.attr("before_date");
        let after_date = group.attr("after_date");
        group.remove();
        group = CommitGroupsRenderer.getCommitGroupComponent(host, parent, undefined, group_commit);
        group.attr("before_date", before_date);
        group.attr("after_date", after_date);
      }

      g = group;
      let all_commits = group
        .datum()
        .concat(commit)
        .sort((a, b) => a.commitDate.getTime() - b.commitDate.getTime());
      let spacing = Number.MAX_VALUE;
      let j = all_commits.indexOf(commit);
      if (j < all_commits.length - 1)
        spacing = Math.min(Math.abs(all_commits[j + 1].commitDate.getTime() - commit.commitDate.getTime()), spacing);
      if (j > 0) spacing = Math.min(Math.abs(all_commits[j - 1].commitDate.getTime() - commit.commitDate.getTime()), spacing);

      group.datum(all_commits);

      let begin_x = host.xScaledTimeZoned(all_commits[0].commitDate);

      g.select("path")
        .attr("d", CommitGroupsRenderer.getCommitGroupPathD(host, all_commits[0], all_commits[all_commits.length - 1], COMMIT_GROUP_HEIGHT))
        .style("--y-offset", `${-COMMIT_GROUP_HEIGHT / 2}px`)
        .attr("fill", all_commits[all_commits.length - 1].color.color);

      g.attr("group_range", Math.max(spacing, g.attr("group_range") || 0));
      g.attr("transform", `translate(${begin_x}, 0)`);
    }

    return g;
  }

  public static getCommitSimpleComponent(host: CommitGroupsHost, parent: d3.Selection<any, Repository, any, any>, commit: Commit): any {
    let g = parent.append("g").datum([commit]);

    g.classed("simple-commit", true);

    let x = host.xScaledTimeZoned(commit.commitDate);

    let comp: d3.Selection<any, any, any, any> = g
      .append("a")
      .attr("href", (d) => d[0].url)
      .attr("target", "_blank");

    if (commit.isCloture) {
      comp = comp.append("circle").attr("class", "commit-cloture");
    } else {
      comp = comp.append("rect").attr("class", "commit-normal");
    }

    comp.attr("fill", commit.color.color);
    g.attr("date", (commit.commitDate as Date).getTime());

    g.attr("transform", `translate(${x}, 0)`)
      .on("mouseenter", () => {
        host.hovered_commit = commit;
        host.hovered_group_commit = undefined;
        host.hovered_g = undefined;
        host.hovered_repository = undefined;
      })
      .on("mouseleave", () => {
        if (host.hovered_commit && host.hovered_commit.commitDate === commit.commitDate) {
          host.hovered_commit = undefined;
        }
      });

    return g;
  }

  public static shouldGroupCommit(host: CommitGroupsHost, commit_before: Commit, commit_after: Commit): any {
    return (
      !commit_before.isCloture &&
      host.xScaledTimeZoned(commit_after.commitDate) - host.xScaledTimeZoned(commit_before.commitDate) < Utils.COMMIT_FUSE_RANGE
    );
  }

  public static getCommitComponent(
    host: CommitGroupsHost,
    parent: d3.Selection<any, Repository, any, any>,
    commit: Commit,
    before: d3.Selection<any, Commit[], any, any>,
  ): any {
    let should_be_grouped_with_last =
      before != null && CommitGroupsRenderer.shouldGroupCommit(host, before.datum()[before.datum().length - 1], commit);

    let g: d3.Selection<any, any, any, any>;

    const time = commit.commitDate.getTime();
    if (!should_be_grouped_with_last) {
      g = CommitGroupsRenderer.getCommitSimpleComponent(host, parent, commit);
      if (before != null) {
        g.attr("before_date", before.attr("end_date") || before.attr("date"));
      }
      g.attr("after_date", time);
    } else {
      g = CommitGroupsRenderer.getCommitGroupComponent(host, parent, before, commit);
      g.attr("end_date", time);
    }

    g.classed("commit", true);

    return g;
  }

  public static getGroupHeight(host: CommitGroupsHost, count: number, min: number, max: number): any {
    if (!host.displayModes.height) return COMMIT_GROUP_HEIGHT;
    if (max <= min) return 18;

    let ratio = (Math.log(count) - Math.log(min)) / (Math.log(max) - Math.log(min));
    return 12 + ratio * 20; // 12px to 32px
  }

  public static getGroupOpacity(host: CommitGroupsHost, count: number, min: number, max: number): any {
    if (!host.displayModes.opacity) return 1.0;
    if (max <= min) return 0.7;

    let ratio = (Math.log(count) - Math.log(min)) / (Math.log(max) - Math.log(min));
    return 0.4 + ratio * 0.6; // 0.4 to 1.0
  }

  public static updateGroupPath(host: CommitGroupsHost, g: any, commits: Commit[], height: number): any {
    let path = g.select("path");
    path.attr("d", CommitGroupsRenderer.getCommitGroupPathD(host, commits[0], commits[commits.length - 1], height));
    path.style("--y-offset", `${-height / 2}px`);
  }

  public static updateGroupText(host: CommitGroupsHost, g: any, commits: Commit[]): any {
    let text = g.select("text.commit-count");
    if (host.displayModes.text) {
      if (text.empty()) {
        text = g
          .append("text")
          .attr("class", "commit-count")
          .attr("y", 2.5)
          .attr("text-anchor", "middle")
          .attr("fill", "white")
          .style("font-size", "8.5px")
          .style("font-weight", "normal")
          .style("stroke", "none")
          .style("pointer-events", "none");
      }

      let actualWidth = host.xScaledTimeZoned(commits[commits.length - 1].commitDate) - host.xScaledTimeZoned(commits[0].commitDate);
      let center_x = actualWidth / 2;

      text.attr("x", center_x).text(commits.length);
    } else {
      text.remove();
    }
  }

  public static updateCommitGroups(host: CommitGroupsHost): any {
    host.repositories_g.forEach((repo_g) => {
      let split = host.refreshRepoBySplittingGroup(repo_g);
      host.refreshRepoByGrouping(repo_g, split);
    });
  }

  public static applyGroupDisplayModes(host: CommitGroupsHost, repo_g: any, minGroupCommits: number, maxGroupCommits: number): any {
    repo_g.selectAll(".commit-group:not(.hidden)").each(function () {
      let g = d3.select(this);
      let commits = g.datum() as Commit[];
      if (commits.length <= 1) return;

      let height = CommitGroupsRenderer.getGroupHeight(host, commits.length, minGroupCommits, maxGroupCommits);
      let opacity = CommitGroupsRenderer.getGroupOpacity(host, commits.length, minGroupCommits, maxGroupCommits);

      CommitGroupsRenderer.updateGroupPath(host, g, commits, height);
      CommitGroupsRenderer.updateGroupText(host, g, commits);

      g.attr("opacity", host.displayModes.opacity ? opacity : 1.0);
    });
  }

  public static checkGroupNeedsSplit(host: CommitGroupsHost, commits: Commit[]): any {
    for (let i = 0; i < commits.length - 1; i++) {
      if (!CommitGroupsRenderer.shouldGroupCommit(host, commits[i], commits[i + 1])) {
        return true;
      }
    }
    return false;
  }

  public static splitCommitGroup(host: CommitGroupsHost, g: any, commits: Commit[], repo_g: any): any {
    if (host.hovered_g?.node() === g.node() || host.hovered_group_commit === commits) {
      host.hovered_g = null;
      host.hovered_group_commit = undefined;
      host.tooltipService.hide();
    }
    let before = undefined;
    g.remove();
    commits.forEach((commit) => {
      before = CommitGroupsRenderer.getCommitComponent(host, repo_g, commit, before);
    });
  }

  public static getSortedCommitNodes(host: CommitGroupsHost, repo_g: any): any {
    let nodes = repo_g.selectAll(".commit").nodes();
    nodes.sort((a: any, b: any) => {
      let aDatum = a.__data__ as Commit[];
      let bDatum = b.__data__ as Commit[];
      if (!aDatum || !aDatum[0] || !bDatum || !bDatum[0]) return 0;
      return aDatum[0].commitDate.getTime() - bDatum[0].commitDate.getTime();
    });
    return nodes;
  }
}
