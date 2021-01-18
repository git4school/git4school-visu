# Change log for Git4School

## 1.3.1

### Added
#### Configuration modal

- A JS alert is asking the user to confirm if they want to leave the configuration modal without saving changes

### Modified

#### General

- Update to **Angular 11**
  - Full migration from TSLint to **ESLint**
- Update to **typescript 4**
- Minor dependency updates
- Migration from npm to _yarn_ for development
- All tooltips and modals have animation

#### Configuration modal

- Start date and end date are now using _ngb-datepicker_
- Date format placeholder are _localized_

## 1.3.0

### Added

#### Home page

- A list on the home page lets the user view, _select_, _modify_, _delete_ the assignments that he has saved, or _add_ a new one
  - The configuration page of an assignment has been refactored so that it can be called in a modal. So, it is now possible to modify any assignment directly from the list

#### General

- The assignment the user is working on is saved **locally** each time it is modified and each time the data is loaded from Github

### Modified

#### General

- Now all tooltips have a **500ms** open delay to meet the usability standards for tooltips.

#### Graphs

- The graphs are no longer accessible as long as no assignment is selected. The tab is no longer visible in this case

#### Metadata edition

- Questions are no longer required in the form to match the model

#### Overview graph

- The file chooser has been transformed into a component to be usable elsewhere in the application (in the edition of an assignment)
- It is possible to select "all" in the TP group of milestones

### Deleted

#### Configuration page

- The page has been removed because it is possible to modify the assignments of the **home page**

### Fixed

- Fixed a navigation bug when no data was loaded

## 1.2.0

### Added

#### General

- It is now possible to start the configuration directly from the application, without a configuration file

### Modified

#### Project

- "Known issues" section updated in the ReadMe

#### General

- Clean up of vulnerabilities, outdated dependencies and warnings displayed in the console
- While the application is running, we now store most of the configuration data in an _Assignment_ object that represents a course. 
  - This will make it easier to switch to local database storage later

#### Configuration page

- A repository that does not have a TP group specified either in the application or in the ReadMe retrieved from Github is now assigned to a default group

#### Overview graph

- When creating a milestone, it is now possible not to assign any TP group to it so that it affects all repositories

### Fixed

- A bug that caused the application to load infinitely and block navigation when all the repositories had been deleted

## 1.1.0

### Added

#### Project

- Continuous integration and deployment of technical and user documentation
  - Additionnal documention section in technical document helping potential contributors to understand how the application is designed
- Continuous deployment of the application on push on _master_ branch
- A clean ReadMe for the project
  - The template for the ReadMe to be read by the application is now in `README.template.md`
- We now use Codacy to track code quality and potential security breaches
- We now work by sprint of 2 weeks represented by milestones on Github
- We now use [Gitmoji](https://github.com/carloscuesta/gitmoji) as a standard for the commits

#### General

- JS docs for a good part of the code

#### Home page

- User guide
  - Localized
  - Will be moved little by little to a website dedicated to the user documentation

#### Graph pages

- Button to reload data from Github on all graph pages

#### Configuration page

- A page allowing to edit and add through an interface metadata, repositories and sessions
  - Ability to edit / add a single repository at a time
    - Form validation checking if the repository has already been added and if the user has access to the existing repository
  - Ability to add several repositories from a list of displayed repositories from the authenticated user
    - A TP group can be indicated to add a set of repositories with the same TP group
    - Already added repositories are already checked in the list
    - Lazy loading scrolling to load sets of 100 repositories
    - Repositories list sorted by creation date
  - Errors about repositories fetching are now indicated per repository in the configuration page
  - Ability to edit / add sessions
    - Form validation checking if the end date is later than the start date
    - Date pickers localized

### Modified

#### General

- Localization updated
- The accepted format of the dates in the configuration file is more flexible
  - accepting `2019-4-2 7:45` and `2019-04-02 07:45`
- Updated to Angular 9
- Name and TP group are now recognized according to the current application language
- Complete refactor for `commitService` for a better management and scalability
- Question recognition is now searching for a ([Github](https://docs.github.com/en/enterprise/2.16/user/github/managing-your-work-on-github/closing-issues-using-keywords#about-issue-references)) closing keyword and then the question

#### Graphs

- All graph components now inherit the same base component to factorize the code and allow potential future integration of new graphs
- Commits closing a question without milestone associated are now displayed in green

#### Overview graph

- It is now possible to upload 2 times in a row the same file
  - This is the only workaround we found for the _reread button bug_

#### Questions completion graphs

- Bar index is now saved for the user session

### Deleted

#### Overview graph

- _Reread_ button because it was not working and there is no workaround to make it work

## 1.0.0

### Added

#### General

- Localization (english & french)
- Connection with Github

#### Home

- Documentation about JSON and ReadMe structure
- Documentation on the use of the application
- Display the CHANGELOG from the Github repository

#### Overview graph

- Displays the student commits given in the JSON configuration file (they have a different shape and color depending on the associated milestones) 
  - Move the mouse over a commit to display its details
  - Click on a commit to open its Github page in a new tab
- Add/edit (or delete) milestones such as reviews, corrections (or others) by clicking on the graph/milestone
- Filter commits and milestones
  - By entering questions in the search bar
  - By selecting a tp group from the drop-down list
- Show or hide milestones
- Change time scale (the time scale automatically adapts itself according to the most relevant option)
- Change zoom mode (and reset zoom mode) :
  - Zoom by dragging the mouse
  - Zoom with the mouse wheel and pan by dragging the mouse
- Upload and reload the JSON configuration file
  - The application checks that the file is valid JSON file, and sends an error toast otherwise
  - The application checks that the configuration file contains all the required fields and dates in the correct format, and sends an error toast otherwise
- Download a compressed file containing :
  - The updated configuration file with the data entered in the application
  - A file describing the progress of each student for all questions
  - A file listing all students commits and their type ("Before review", "After correction", ...)

#### Students commits and questions completion graphs

- Display the distribution of commits for each student (students commits graph)
  - Move the mouse over a bar to see details
- Display students progress for each question (questions completion graph)
  - Move the mouse over a bar to see details (such as the students corresponding to the type of commit)
  - Change the index of a red horizontal bar with a slider
- Filter data
  - By selecting a tp group from the drop-down list
  - By selecting a date with the slider
  - By clicking on datasets in the legend

#### Metadata edition

- Edit metadata (title, course, program, year)
- Add or remove a start date or an end date
- Add or remove questions
