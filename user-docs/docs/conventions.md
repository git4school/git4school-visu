---
title: Get the repositories working with the tool
layout: page
nav_order: 4
---

# Get the repositories working with the tool
{: .no_toc }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## ReadMe format

In order for the tool to be able to retrieve the name of the student and their work group, it reads the README.md file, so it must follow  in a fairly **precise format**, which is the following :

<div class="code-example" markdown="1">

# First IT practical
{: .no_toc }

### LAST NAME : DOE
{: .no_toc }
### First name : John
{: .no_toc }
### TP group : 
{: .no_toc }
- [ ] 11
- [x] 12
- [ ] 21
- [ ] 22

</div>
```markdown
# First IT practical

### LAST NAME : DOE
### First name : John
### TP group : 
- [ ] 11
- [x] 12
- [ ] 21
- [ ] 22
```

In this file, 2 informations are retrieved :
- the student's name is retrieved by **reading the words after the tokens** `LAST NAME :` and `First name :` are then concatenated. Which means _it doesn't matter if the tokens are a title or not or if something else is written before_

<small>Note that the name extraction is dependent on the selected language ! For french, the token are `NOM :` and `Prénom :`.</small>
{: .ml-4}

- the student's work group is retrived by **reading what is after the token** `- [x]`. This means that if you want to use a checklist in your README, _you have to do it after_

<small>In fact, the character between the brackets can be anything as long as it's not a whitespace</small>
{: .ml-4}

---

## Closing commit keywords

To identify whether a commit is a closing commit of a question, the tool uses the same syntax [as Github](https://docs.github.com/en/github/managing-your-work-on-github/linking-a-pull-request-to-an-issue#linking-a-pull-request-to-an-issue-using-a-keyword) to close an issue.

<center>
    <img src="/assets/images/closingKeyword.png">
    <small>
        <em>The regular expression used to detect a close commit</em>
    </small>
</center>

As you can see, the close commit keyword must be **followed by a space**, then the **question ID**, represented in the image above by `group #1`.

<small>The question syntax being completely unrestricted, it is possible to link questions with Github `#n` issues.</small>
