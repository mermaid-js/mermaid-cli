# Contributing

[fork]: ../../fork
[pr]: /compare
[style]: https://prettier.io/
[code-of-conduct]: CODE_OF_CONDUCT.md

Hi there! I'm thrilled that you'd like to contribute to this project. Your help is essential for keeping it great.

Please note that this project is released with a [Contributor Code of Conduct][code-of-conduct]. By participating in this project you agree to abide by its terms.

## Submitting a pull request

1. [Fork][fork] and clone the repository
2. Configure and install the dependencies: `npm install`
3. Create a new branch: `git checkout -b my-branch-name`. Make sure to give a good name to the branch. New features shall start with `feature/<branch name>`. Bug fixes shall start with `fix/<branch-name>`
4. Make your change, add tests, and make sure the tests still pass - including
    1. Unit tests (`npm test`)
    2. E2E tests (`npm run test:cli`)
5. Push to your fork and [submit a pull request][pr]
6. Give yourself a high five, and wait for your pull request to be reviewed and merged.

Here are a few things you can do that will increase the likelihood of your pull request is accepted:

- Follow the [style guide][style] which is using [prettier][style]. Any linting errors should be shown when running `npm test`.
    - Some linting errors might be automatically fixed by `npm run lint-fix`.
- Write and update tests.
- Keep your change as focused as possible. If there are multiple changes you would like to make that are not dependent upon each other, submit them as separate pull requests.
- Write a [good commit message](http://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html).

Work in the Progress pull requests are also welcome to get feedback early on, or if there is something blocking you.

## Resources

- [How to Contribute to Open Source](https://opensource.guide/how-to-contribute/)
- [Using Pull Requests](https://help.github.com/articles/about-pull-requests/)
- [GitHub Help](https://help.github.com)
'''mermaid
flowchart TD
    %% --- Node Definitions ---
    
    %% Step 1: ADMET
    S1[<b>1. ADMET Properties</b><br/>Evaluate ADMET properties of compounds]

    %% Step 2: PubChem
    S2[<b>2. PubChem</b><br/>Retrieve Canonical SMILES of compounds]
    S2_1[Open Structure-to-Canonical SMILES Generator<br/>and paste SMILES]
    S2_2[Convert & copy generated Canonical SMILES]

    %% Step 3: SwissTargetPrediction
    S3[<b>3. SwissTargetPrediction</b><br/>Paste Canonical SMILES into SwissTargetPrediction]
    S3_1[Set Species to <i>Homo sapiens</i>]
    S3_2[Click <b>Predict Targets</b>]
    S3_3[Export results as Excel file <i>'X'</i>]

    %% Step 4: GeneCards
    S4[<b>4. GeneCards</b><br/>Login to GeneCards]
    S4_1[Search for targeted disease<br/><i>e.g., Keratoconus / Disease Name</i>]
    S4_2[Click <b>Export</b> to download Excel file]

    %% Step 5: Venn Diagram
    S5[<b>5. Venn Diagram Analysis</b><br/>Open SwissTarget file -> Select 'Common Name' column]
    S5_1[Paste into Venny - List 1<br/><i>Rename List 1 to Compound Name</i>]
    S5_2[Open GeneCards file -> Select 'Gene Symbol' column]
    S5_3[Paste into Venny - List 2<br/><i>Rename List 2 to Disease Name</i>]
    S5_4[Click <b>Submit</b>]
    S5_5[Save Venn Diagram image as <b>PNG</b>]
    S5_6[Copy <b>Common Genes</b> list]
    S5_7[Open Word doc: Save image & paste common genes<br/><i>Rename file: 'Common Genes'</i>]

    %% Step 6: STRING
    S6[<b>6. STRING Database</b><br/>Go to STRING database & Login]
    S6_1[Navigate to <b>Multiple Proteins</b>]
    S6_2[Paste common genes list from Venn Diagram]
    S6_3[Select Organism: <i>Homo sapiens</i>]
    S6_4[Click <b>Search</b> & <b>Continue</b>]
    S6_5[<b>Export Image:</b> Go to 2nd option<br/><i>High-Resolution Image</i> -> Download]
    S6_6[<b>Export Data:</b> Go to 4th option<br/><i>Tabular Format (.tsv)</i> -> Download]
    S6_7[Click <b>Analysis</b> -> Copy all values<br/>Paste under image in Word file & Save]

    %% Step 7: Cytoscape
    S7[<b>7. Cytoscape (Network Analysis)</b><br/>Open Cytoscape App]
    S7_1[File -> Import -> Network from File<br/><i>Select downloaded STRING .tsv file -> Click OK</i>]
    S7_2[Go to <b>cytoHubba</b> plugin -> Calculate Node Scores]
    S7_3[Under 'Select Nodes & Hubba Nodes':<br/>If Count > 10, set to Top 10 nodes ranked by <b>DEGREE</b>]
    S7_4[Display shortest path under 'Display Options' -> Click <b>Submit</b>]
    S7_5[Save current rank to designated folder<br/><i>Rename as 'Hub Genes'</i>]
    S7_6[Open Excel -> Create 2 columns: <b>Compound</b> & <b>Target</b><br/>Select gene columns & paste data]
    S7_7[In Cytoscape: Import Network from File -> Select <b>Comp & Target Excel File</b>]
    S7_8[Adjust Logo / Style settings -> Click <b>OK</b>]
    S7_9[Export image at full size with transparent background (.png)]

    %% Step 8: ShinyGO
    S8[<b>8. ShinyGO (Enrichment Analysis)</b><br/>Open ShinyGO app]
    S8_1[Open 'Hub Genes' file -> Copy gene list and scores]
    S8_2[Paste into ShinyGO & set parameters:<br/>• <b>FDR Cutoff:</b> 0.05<br/>• <b>Pathways to show:</b> 10]
    S8_3[Click <b>Submit</b>]
    S8_4[Download Top Pathways chart/table<br/><i>Rename file: 'KEGG Hepatocellular / KEGG Pathway'</i>]

    %% Step 9: KEGG Pathway Mapper
    S9[<b>9. KEGG Pathway Mapper</b><br/>Select Top 3 genes from analysis]
    S9_1[Paste Top 3 genes into Search field]
    S9_2[Execute Search -> Change colors as needed]
    S9_3[Download pathway image & Save as <b>PNG</b>]

    %% --- Connections / Flow ---
    S1 --> S2
    S2 --> S2_1 --> S2_2 --> S3
    S3 --> S3_1 --> S3_2 --> S3_3
    
    S3_3 --> S5
    S4 --> S4_1 --> S4_2 --> S5
    
    S5 --> S5_1 --> S5_2 --> S5_3 --> S5_4 --> S5_5 --> S5_6 --> S5_7
    S5_7 --> S6
    
    S6 --> S6_1 --> S6_2 --> S6_3 --> S6_4
    S6_4 --> S6_5
    S6_4 --> S6_6
    S6_4 --> S6_7
    
    S6_6 --> S7
    S7 --> S7_1 --> S7_2 --> S7_3 --> S7_4 --> S7_5 --> S7_6 --> S7_7 --> S7_8 --> S7_9
    
    S7_5 --> S8
    S8 --> S8_1 --> S8_2 --> S8_3 --> S8_4
    
    S8_4 --> S9
    S9 --> S9_1 --> S9_2 --> S9_3'''
  
