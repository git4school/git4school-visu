---
title: Configure an assignment
layout: page
parent: Configure
nav_order: 2
---

# Configure an assignment
{: .no_toc }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Edit metadata

To save the metadata, it is **necessary to give a title**. This is the _only field required_ for the metadata.

The `course`, `program` and `year` fields are for information purposes only and have _no impact_ for the moment.

The `start date` is the date from which commits are retrieved from Github. _This feature is very useful in the case of repositories created from a Github Classroom assignment that is several months or even years old_. The `end date` works in the same way, the date up to which commits are retrieved.

The `questions` are the questions of the whole course. These are **the only questions** that will be **assignable** in the milestones, or the question filter in the _overview_ graph.

<center>
    <img src="/assets/images/edit-metadata.png" width="600"><br>
    <small>
        <em>The metadata edition page</em>
    </small>
</center>

---

## Edit repositories

There are 2 ways to add repositories :
- by manually entering the repository URL _(left button)_
- by browsing through the Github repositories and selecting one or more repositories to add _(right button)_

In any case, for each repository, if the name of the student and his work group are not entered in the row, when loading the data from Github, the readme of the repository is read to extract the name of the student and his work group. [<small>See more about the ReadMe format</small>]({% link docs/conventions.md %})  
Finally, if these values are not found in the readme, the _name of the repository_ is assigned to the student's name, and group `1` is assigned to it.

After loading the data from Github, if a problem has occurred with a repository, an icon is displayed next to it, it's **hoverable** and displays more information about the error.

<center>
    <img src="/assets/images/edit-repositories.png" width="600"><br>
    <small>
        <em>The repositories edition page</em>
    </small>
</center>

### Manually add a repository

To confirm a manually added repository, the application **verifies that you have access to the repository** corresponding to the URL entered. If this is not the case, the row is _invalid_ and it is not possible to confirm it.


### Browsing and adding repositories

When you get to this page, the **repositories already added appear checked**.  
<small>Unchecking them will not remove them.</small>

Also, repositories in which the Github account you are logged in with is a contributor are displayed by default. 

The list is _limited to 100 repositories_, when you scroll to the bottom of the list, the _next 100 repositories are loaded_.

<center>
    <img src="/assets/images/add-repositories.png" width="600"><br>
    <small>
        <em>The add repositories page</em>
    </small>
</center>

It is possible to enter **search words** in the field at the top to search for repositories in Github _(after 1 second of inactivity)_.  
<small>Only the repositories that are accessible with the connected account are displayed.</small>

At the bottom of this page, you can enter a work group that will be **assigned to all added repositories**.

To validate the addition of repositories, simply click on the `Add` button at the bottom right.

---

## Edit sessions

When adding a session, the current date is selected.

For a row to be valid, **start and end times must be provided** and the **end time must be later than the start time**.

It is possible to specify a work group, but this _does not have any impact for the moment_.

<small>Due to the attributes of a session, it is impossible to have one session over 2 days.</small>

<center>
    <img src="/assets/images/edit-sessions.png" width="700"><br>
    <small>
        <em>The sessions edition page</em>
    </small>
</center>

---

## Export/import an assignment

It is possible to export an single assignment. To do so, _select it_ in the _home page_, then click on the export button in the navigation bar.

<center>
    <img src="/assets/images/navbar.png" width="250"><br>
    <small>
        <em>Navigation bar : export button in the middle</em>
    </small>
</center>

To import this assignment, all you have to do now is _add or edit an assignment_. Once in the assignment configuration page, click on the button at the top right of the title. Then enter the JSON file and the assignment will be imported.

<center>
    <img src="/assets/images/import-assignment.png"><br>
    <small>
        <em>The import button</em>
    </small>
</center>

---

## Saving changes

**No changes are saved without pressing the "save" button**.  
If the assignment is changed, an alert notifies you when you try to quit the assignment edition and the changes have not been saved.

If at least one _row is being edited_, it's _impossible to save_. Also, if a _field_ in the row is _invalid_, you _cannot confirm it_.

Saving is independent between editing metadata, repositories and sessions. This means that you can, for example, edit and save metadata, delete a repository by mistake and quit without saving to cancel this last change. It also means that **you have to save each part** when you modify several of them.

<center>
    <img src="/assets/images/to-save.png" width="200"><br>
    <small>
        <em>Icon displayed when changes need to be saved</em>
    </small>
</center>

To quickly see which part is to be saved, an icon is displayed next to the title of the part concerned.