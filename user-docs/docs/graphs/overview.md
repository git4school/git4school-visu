---
title: Overview graph
layout: page
parent: Graph views
nav_order: 1
---

# Overview graph
{: .no_toc }

This page lets the teacher follow the work of his students using a graph displaying the commits of each student (on the y axis) according to time (on the abscissa) as well as the sessions of TP, reviews and corrections.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Features

In this graph, student commits are visible. Milestones and sessions are also shown. Each commit is colored according to its type :
- <span style="color:black">black</span> : the commit is called _intermediate_ and isn't closing a question
- <span style="color:green">green</span> : the commit closes a question and is **before** the associated **review**
- <span style="color:orange">orange</span> : the commit closes a question and is **between** the associated **review and correction** 
- <span style="color:red">red</span> : the commit closes a question and is **after** the associated **correction**



<center>
    <img src="/assets/images/overview-graph.png" ><br>
    <small>
        <em>Overview graph</em>
    </small>
</center>

The sessions are represented with <span style="color:blue">blue rectangles</span>.

Reviews are <span style="color:blue">blue vertical lines</span>, corrections <span style="color:red">red vertical lines</span> and others <span style="color:black">black vertical lines</span>

- You can **hover** a commit to see its message and author. If you **click** on it, the Github page of the commit opens in a new tab

- You can also click anywhere on the graph to add a milestone, or click on an existing milestone to edit or delete it.  
[<small>See more about configuring milestone</small>]({% link docs/configure/configure-milestones.md %})

---

## Filter commits

It is possible to filter the repositories or some of the commits displayed.

<center>
    <img src="/assets/images/filter.png" width="600"><br>
    <small>
        <em>Filtering elements, here only the commits related to questions 0.5.2 and 2.1 are displayed</em>
    </small>
</center>

There are 2 ways to filter data :
- Filter the **commits** according to the questions you want to see solved with the input in which it is possible to add or delete questions

<small>Only the questions defined in metadata can be selected ([see how to configure metadata]({% link docs/configure/configure-assignment.md %}))</small>
{: .ml-4}

- Filter the **repositories** as well as the **milestones** according to a workgroup using the dropdown list on the right. _By default, all repositories are displayed and the `All` option displays all of them_

---

## Hide annotations

You can **graphically** hide milestones and sessions. The commits type will still be affected by the milestone.

<center>
    <img src="/assets/images/hide.png" width="150"><br>
    <small>
        <em>Hiding milestones and sessions, all are displayed here</em>
    </small>
</center>

---

## Utilities and refresh

<center>
    <img src="/assets/images/other-buttons.png" width="200"><br>
    <small>
        <em>Some utilities to help with navigation withing the graph and refreshing data from Github button</em>
    </small>
</center>

- The first button **resets the zoom**. You can also press the _space bar_ for the same result

- The second button **switches** between the 2 **zoom modes** : 
    - zoom with the mouse **cursor** 
    - zoom with the mouse **wheel** and move with the cursor

- The third button **switches** between 3 **time scales** 

<small>The time scale adapts in real time with the zoom level</small>
{: .ml-4}

- The last button on the right is for **reloading** the data from Github