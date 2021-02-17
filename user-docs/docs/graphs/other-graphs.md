---
title: Other graphs
layout: page
parent: Graph views
nav_order: 2
---

# Other graphs
{: .no_toc }

These graphs make it possible to bring out certain information according to the data returned by Github.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Students commits graph

This graph shows the _distribution of commit types_ for each student. This allows, when related to the total number of commits and the progression in the questions, to have an indication of how the student works, and to identify possible difficulties.

The colors correspond to the same meanings as in the _[overview graph]({% link docs/graphs/overview.md %})_.

There are 2 new elements in the graph:
- the **total commit count** of a student, represented by the <span style="color:green">green curve</span>

- the **last question answered** by the student, their progress, as represented by the <span style="color:blue">blue curve</span>

<center>
    <img src="/assets/images/students-commits.png">
    <small>
        <em>Students commits graph</em>
    </small>
</center>

It's possible to **hover** each portion (commit type), to see the _number of commits_ of this type.

---

## Questions completion graph

This graph shows the _progress_ of an entire group (or all) on the questions, helping the teacher to plan reviews and corrections at the best possible time. For each question, we see the distribution of the types of its closing commits 

Here again, the colors correspond to the same meanings as in the _[overview graph]({% link docs/graphs/overview.md %})_. But a new color is present, _gray_, for all the students who did not answer the question.

<center>
    <img src="/assets/images/questions-completion.png">
    <small>
        <em>Questions completion graph</em>
    </small>
</center>

The **red bar** on the graph is a _purely graphical element_, moveable from 10 to 90. The goal is to have a level at which the teacher knows it is time to start the next questions.

It can be moved 10 by 10 with the bar shown below.

<center>
    <img src="/assets/images/bar-index.png"><br>
    <small>
        <em>Bar index slider</em>
    </small>
</center>

It is possible to **hover** a portion to see the _list_ and the _number of students_ in that portion.

---

## Toolbar

Both graphs have a toolbar with most of the elements in common.

<center>
    <img src="/assets/images/tool-bar.png" width="600"><br>
    <small>
        <em>Common toolbar for both graphs</em>
    </small>
</center>

- The first element is used to **filter the commits** according to a workgroup. _By default, all commits are displayed and the `All` option displays all of them_

- The second element allows to "**travel in time**", to take into account the commits only up to the selected date
    - By default, the _date of the last commit is selected_ and it is possible to go back to the date of the first commit

- The last element, the button on the right is for **reloading** the data from Github

Finally, for both graphs, it is possible to **hide the datasets** by _clicking on them_ in the legend.

<center>
    <img src="/assets/images/filter-datasets.png" width="600"><br>
    <small>
        <em>Common toolbar for both graphs</em>
    </small>
</center>