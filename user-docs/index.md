---
title: Home
layout: home
nav_order: 1
permalink: /
---

# Follow the progress of your students
{: .fs-9 }

Git4School is a dashboard for supporting teacher interventions in Software Engineering courses.
{: .fs-6 .fw-300 }

[Try Git4School](https://git4school.firebaseapp.com){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 }
[View it on GitHub](https://github.com/git4school/git4school-visu){: .btn .fs-5 .mb-4 .mb-md-0 }

---

## Getting started

### Introduction

Git4School is an application that helps teachers follow the progress of their students during practical work sessions using Github. From the monitoring over time of student commits to the completion rate of each question by the TP group, as well as the distribution of the types of commits of each student (before / after a correction...), the teacher has access to several tools to best support his students during the practical work sessions.

### A little bit of vocabulary

In Git4School, you will manage assignments. 
- An **assignment** is a collection of _repositories_, _milestones_, and _sessions_, along with metadata (start date, end date, title, questions, ...). An assignment can be thought of as a _class_ that can be separated into several groups that have the same work to do.
- A **repository** is a _git repository_ hosted on Github. In the tool, we assume that a repository represents the work of a student.
- The **milestones** are divided into 3 categories :
    - a **review** milestone, a phase where students _share pieces of their code_ and the teacher can correct parts of the subject
    - a **correction** milestone, a phase where the _complete correction_ of the subject is given to the students
    - an **other** milestone, a purely _graphical milestone_, which has no impact whatsoever on the data
- The **sessions** are purely _graphic elements_. They will appear as a blue rectangle in the overview graph and represent _practical work sessions_

### Quick start : using Git4School for the first time

1. Login  
The first thing to do is to log in with your Github account.
You will be redirected to the Github login page where you can also authorize or request access to your organization's repositories.
Once logged in, you will be redirected to Git4School.
[<small>See more about authentication</small>]({% link docs/misc.md %})

2. Add an assignment  
Add an assignment by clicking on the _plus_ button on the _home page_. In the window that opens, enter a title, the questions to be completed in your assignment sheet and save. Then, in the _repositories_ tab, add your students' repositories and save and exit the window.
[<small>See more about configuring an assignment</small>]({% link docs/configure/configure-assignment.md %})

3. Select the newly added assignment  
Once added, you can select the assignment by clicking on the blue button with an _arrow_ which will load the data and take you to the _overview_ graph.

4. Add milestones  
From the page you just landed on, you can click anywhere on the graph to add milestones. Choose the type of milestone, the questions concerned and confirm. The commits are colored directly according to the added milestones.
[<small>See more about configuring milestones</small>]({% link docs/configure/configure-milestones.md %})

5. Here you go !  
_You have just set up your first assignment !_ You can add or delete repositories, milestones or sessions at any time in its configuration page. You will find more information about the features of the application in the other pages of this documentation.
[<small>See more about graphs</small>]({% link docs/graphs/index.md %})

---

## Bugs

If you encounter any bugs, feel free to [open an issue on Github](https://github.com/git4school/git4school-visu/issues/new?assignees=&labels=bug&template=bug-template.md&title=), we will deal with it as soon as possible !

---

## Changelog

- [See our changelog on Github](https://github.com/git4school/git4school-visu/blob/master/CHANGELOG.md)
