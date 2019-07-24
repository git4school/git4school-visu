# Change log for Git4School

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
