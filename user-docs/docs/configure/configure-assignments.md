---
title: Configure the assignments
layout: page
parent: Configure
nav_order: 1
---

# Configure the assignments
{: .no_toc }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

To manipulate the assignments you have to go to the _home page_. You will come across a table like the one below. These are all the assignments available **only on your machine and browser**. If you want to retrieve your assignments on another browser or computer, you have to [export them](#exportimport-all-assignments).

<center>
    <img src="/assets/images/assignments.png">
    <small>
        <em>Assignments list</em>
    </small>
</center>

To **select** an assignment, click on the blue button with an arrow. This will take you directly to the _overview graph_.


## Add an assignment

To add an assignment, simply click on the blue "plus" button. This will bring up the [assignment configuration]({% link docs/configure/configure-assignment.md %}) window. 

If no changes are saved, the assignment is not added.

---

## Edit an assignment

Clicking on the button with the gearwheel will open the [assignment configuration]({% link docs/configure/configure-assignment.md %}) window.

It is also possible to edit the configuration of the **selected assignment** from the `Graphs` pages by clicking on the gearwheel in the navigation bar.

<center>
    <img src="/assets/images/navbar.png" width="250"><br>
    <small>
        <em>Navigation bar : assignment configuration, export button <br>and user documentation, from left to right</em>
    </small>
</center>

_If a change is made to the selected assignment, the data are reloaded from Github._

---

## Delete an assignment

The deletion of an assignment is **definitive** and is done by clicking on the _red button with the trash can_.

---

## Export/import all assignments

If you want to move your assignments from one computer to another, you have to _export them and then import them_ to another computer.
To do so, you must use the 2 buttons located on the top right of the table.


<center>
    <img src="/assets/images/assignments-buttons.png"><br>
    <small>
        <em>Export and import buttons</em>
    </small>
</center>

- The **export** is done using the _middle button_. This will then download a JSON file named `assignments.json` containing all the assignments from your workspace.

- To **import** _all the assignments_, click on the _right button_ and upload the JSON file from an export.

> Importing assignments will **delete the existing ones** in your workspace and then perform the import !
{: .fw-500 .ml-4 .text-red-300 }

---

## Delete database

The field `Id` visible as the first element in the table is generated automatically and identifies an assignment, _that is why it is possible to have two assignments with the same name_. It is incremented with each new assignment. If you want to reset these identifiers, the only thing to do is to **delete the database**.

This action will delete all your assignments !
{: .fw-500 .text-red-300 }

<center>
    <img src="/assets/images/devtools.png" width="600"><br>
    <small>
        <em>DevTools, what you see when deleting the database</em>
    </small>
</center>

Here are the steps to follow on any browser _based on Chromium_ :

1. [Open DevTools](https://developers.google.com/web/tools/chrome-devtools/open)
2. Go to the `Application` tab
3. In the `Storage` section, unfold `IndexedDB` then click on `assignmentsdb`.
4. On the right, information about the database is displayed, under which you can click on `Delete database`.