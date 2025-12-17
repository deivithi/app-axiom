-- Add UPDATE and DELETE policies for axiom_score_history
-- Users should be able to manage their own score history

CREATE POLICY "Users can update own score history"
ON public.axiom_score_history
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own score history"
ON public.axiom_score_history
FOR DELETE
USING (auth.uid() = user_id);