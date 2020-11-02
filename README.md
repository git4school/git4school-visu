<h1 align="center">Git4School</h1>

<h4 align="center">A website that helps teachers follow the progress of their students</h4>

<p align="center">
  <a href="https://github.com/git4school/git4school-visu/actions?query=workflow%3A%22Build+and+Deploy%22"><img alt="GitHub Workflow Status" src="https://img.shields.io/github/workflow/status/git4school/git4school-visu/Build%20and%20Deploy?logo=github-actions&logoColor=white&label=build%20%26%20deploy"></a>
  <!-- Insert codacy badge when set up -->
  <a href="https://git4school.firebaseapp.com"><img alt="Website" src="https://img.shields.io/website?logo=firebase&logoColor=white&color=lightseagreen&url=https%3A%2F%2Fgit4school.firebaseapp.com"></a>
  <a href="https://github.com/git4school/git4school-visu/blob/master/package.json"><img alt="GitHub package.json dependency version (prod)" src="https://img.shields.io/github/package-json/dependency-version/git4school/git4school-visu/@angular/core?label=angular&logo=angular"></a>
  <a href="https://github.com/git4school/git4school-visu/blob/master/LICENSE">
    <img src="https://img.shields.io/github/license/git4school/git4school-visu?logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABmJLR0QA/wD/AP+gvaeTAAABTUlEQVRYhe2WQUoDMRSGM1K7FyzqERQ8gUco6F26EqFuikjdKr1Lhdm50wvUI6go4k4rn4u+QkyTzHsGFGF+CMPk5X/vm2QmGedatfqPAjrABfAIPABjoPObAGNWdf6TXFWmCAr/geS4aSxUVdFaa4oi2byF/rSALnAvrRvETiNLMNT6tQADL/kgiK0HEMPwJcz5NcV7wIuX4BXYiowj9q5o/TmAiRivpQFMDAAqf6r4HvABzIF9YBd4X943AVj8KYCp5L30+q6kr1YAqP2x4kcy8BnY9Po3gCeJHaYArP4YwIxmzTIAJr9zqxvRTnaKFtrOxMz+EOBWrmdVIOfccq+/yyQv8wN9maY5cMzie+4BJ8CnxPre+HAJTP4UxCizfqNg7DcAq79pJmrgTVodI48BWPzFSgFYVHocF8t0nmufNvXzEdOfz0CrVq2+AJqX502CkqgHAAAAAElFTkSuQmCC">
  </a>
  <img alt="Lines of code" src="https://img.shields.io/tokei/lines/github/git4school/git4school-visu?color=red">
</p>

<p align="center">
  <a href="#backgroung">Background</a> •
  <a href="#description">Description</a> •
  <a href="#features">Features</a> •
  <a href="#contribute">Contribute</a> •
  <a href="#links">Links</a> •
  <a href="#license">License</a>
</p>

## Background

<details><summary>Click to read the background behind this project</summary>
E-education is a field aiming to support teaching and learning using digital tools. It is more than ever in tune with the time and is becoming an important learning tool. In this context, Jean-Baptiste Raclet and Franck Sylvestre, teacher-researchers at IRIT, are working together on a programming learning protocol. Based on test-driven development, peer reviewing and iterative approach (testing, development, peer reviewing, testing, development, ...), the protocol uses digital tools such as <a href="https://elaastic.irit.fr/elaastic-questions/">Elaastic</a> and Git4School. To understand the need behind Git4School, it is necessary to detail the "development" part of the protocol. In a practice session, a question sheet is given to the students. Then, they develop the features that validate the tests. At the end of each question, the student has to commit his code to his Github repository, with a message identifying the question. After a certain amount of sessions, the teacher will organize a peer review, and then later send the correction to the students. It is therefore important that the teacher is able to follow the progress of the group in order to make reviews and corrections neither too early nor too late. It is to avoid having to visit each repository to get an idea of the group's progression that this project was created.

</details>

## Description

> You can find detailed documentation to get started [here](https://git4school.github.io/)

Git4School is an application that helps teachers follow the progress of their students during practical work sessions using Github.
From the monitoring over time of student commits to the completion rate of each question by the TP group, as well as the distribution of the types of commits of each student (before / after a correction...), the teacher has access to several tools to best support his students during the practical work sessions.

## Features

- Display commits of multiple repositories on a single view
- **Filter** commits by TP group or by resolved question
- Add **markers** (session, review, correction) and see when associated questions have been resolved in relation to these markers using colored indicators
  <img src="src/assets/images/readme-overview.png">
- Have an **overview** of the students' work habits
- Go **back in time** to a specific date
  <img src="src/assets/images/readme-students-commits.png">
- See the **completion ratio** in the group for each question.
- Go **back in time** to a specific date
  <img src="src/assets/images/readme-questions-completion.png">
- Easily view and add user accessible repositories
- Export of statistics on commits

## Contribute

## Links

- [User documentation](https://git4school.github.io/) : this is where you need to go to if you want to get started with the application 
- [Technical documentation](https://git4school.github.io/git4school-visu/) : if you want to add your contribution to the project, it is strongly recommended to go through this link. This is where you will see how it all works.
- [Github API documentation](https://docs.github.com/en/free-pro-team@latest/rest) : here is useful documentation for making calls to the Github API
- [Chart.js](https://link) & [ng2-charts documentation](https://link) : documentation for the library we use for graphs
- [Firebase documentation](https://firebase.google.com/docs/web/setup) : 
## License

Git4School is made available under the [Apache 2.0 License](https://github.com/git4school/git4school-visu/blob/master/LICENSE).
